"""Release invariants discovered during the 18 September deep audit."""

import uuid
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.clinical.services import apply_dda_override
from apps.games.models import DifficultyState, GameDefinition
from apps.games.performance import record_performance
from apps.routines.models import Medication
from apps.shared.tests.factories import (
    CareAssignmentFactory,
    DoctorAssignmentFactory,
    DoctorFactory,
    PatientFactory,
)

pytestmark = pytest.mark.django_db


def test_invalid_alert_patient_returns_400():
    _, doctor, client = setup_patient()
    client.force_authenticate(user=doctor)
    assert client.get("/api/v1/alerts/?patient=not-a-uuid").status_code == 400


def test_maximum_report_date_returns_400():
    patient, doctor, client = setup_patient()
    client.force_authenticate(user=doctor)
    assert (
        client.get(
            f"/api/v1/patients/{patient.id}/report/?from=9999-12-31&to=9999-12-31"
        ).status_code
        == 400
    )


@pytest.mark.parametrize("language", ["brx", "kha", "grt", "ne", "trp"])
def test_new_language_preferences_persist(language):
    patient, _, client = setup_patient()
    response = client.patch("/api/v1/auth/me/preferences/", {"language": language}, format="json")
    assert response.status_code == 200
    patient.user.refresh_from_db()
    assert patient.user.language == language


def test_primary_contact_tracks_active_assignment():
    patient, _, client = setup_patient()
    assignment = CareAssignmentFactory.create(patient=patient, is_primary=True)
    assignment.caregiver.phone = "+919876543210"
    assignment.caregiver.save()
    assert (
        client.get(f"/api/v1/patients/{patient.id}/primary-contact/").data["phone"]
        == "+919876543210"
    )
    assignment.active = False
    assignment.is_primary = False
    assignment.save()
    assert client.get(f"/api/v1/patients/{patient.id}/primary-contact/").data is None


def setup_patient():
    patient = PatientFactory.create()
    doctor = DoctorFactory.create()
    DoctorAssignmentFactory.create(patient=patient, doctor=doctor)
    client = APIClient()
    client.force_authenticate(user=patient.user)
    return patient, doctor, client


def test_patient_medication_list_excludes_expired_prescription():
    patient, doctor, client = setup_patient()
    today = timezone.localdate()
    Medication.objects.create(
        patient=patient,
        prescribed_by=doctor,
        name="Expired prescription",
        dose="1",
        times=["08:00"],
        active=True,
        start_date=today - timedelta(days=10),
        end_date=today - timedelta(days=1),
    )
    result = client.get(f"/api/v1/patients/{patient.id}/medications/")
    assert result.status_code == 200
    assert not result.data, "Patient must not see an expired prescription as current medicine"


def test_doctor_lock_cannot_exceed_existing_game_cap():
    patient, doctor, _ = setup_patient()
    game = GameDefinition.objects.create(
        key="audit_game", name="Audit game", min_level=1, max_level=5
    )
    state = DifficultyState.objects.create(patient=patient, game=game, level=2, cap_level=2)
    apply_dda_override(
        patient=patient,
        doctor=doctor,
        game=game,
        data={"action": "lock", "value": 5, "reason": "Synthetic audit"},
    )
    state.refresh_from_db()
    assert state.level <= state.cap_level, "Lock operation must preserve clinician cap"


def test_baseline_cap_applies_immediately_to_existing_difficulty_state():
    patient, doctor, _ = setup_patient()
    game = GameDefinition.objects.create(
        key="audit_game", name="Audit game", min_level=1, max_level=5
    )
    state = DifficultyState.objects.create(patient=patient, game=game, level=5)
    client = APIClient()
    client.force_authenticate(user=doctor)
    response = client.put(
        f"/api/v1/patients/{patient.id}/baseline/", {"max_difficulty_level": 2}, format="json"
    )
    assert response.status_code == 200
    state.refresh_from_db()
    assert state.level <= 2, "Existing level must obey newly saved global cap before next game"


def test_round_decision_does_not_return_level_above_global_cap():
    patient, _, _ = setup_patient()
    patient.max_difficulty_level = 2
    patient.save()
    game = GameDefinition.objects.create(
        key="audit_game", name="Audit game", min_level=1, max_level=5
    )
    DifficultyState.objects.create(patient=patient, game=game, level=5)
    decision = record_performance(
        patient,
        {
            "id": uuid.uuid4(),
            "session_id": uuid.uuid4(),
            "game_id": "audit_game",
            "difficulty": 5,
            "accuracy": 0.5,
            "reaction_time_ms": 1500,
            "errors": 1,
            "hints_used": 0,
            "completed": False,
            "early_exit": False,
            "session_duration_sec": 20,
            "rounds_completed": 1,
            "timestamp": timezone.now(),
        },
    )
    assert decision["difficulty"] <= 2, "One-level adaptation bound must not override safety cap"


def test_huge_metric_returns_validation_error_instead_of_server_error():
    patient, _, client = setup_patient()
    GameDefinition.objects.create(key="audit_game", name="Audit game", min_level=1, max_level=5)
    now = timezone.now().isoformat()
    client.raise_request_exception = False
    response = client.post(
        f"/api/v1/patients/{patient.id}/game-sessions/",
        {
            "game_key": "audit_game",
            "seed": "audit",
            "level": 1,
            "metrics": {
                "accuracy": 0.5,
                "mean_reaction_ms": 1000,
                "mistakes": 10**1000,
                "hints_used": 0,
                "rounds": 1,
                "completed": True,
            },
            "started_at": now,
            "ended_at": now,
        },
        format="json",
    )
    assert response.status_code == 400, "Huge JSON integer must not overflow metric validation"
