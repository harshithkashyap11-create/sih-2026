from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.accounts.models import User
from apps.audit.services import audit
from apps.clinical.models import ClinicalNote, DdaOverride, ExerciseAssignment
from apps.games.models import DifficultyChange, DifficultyState, GameDefinition, GameSession
from apps.patients.models import PatientProfile
from apps.routines.models import RoutineItem


def validate_note_reply(*, patient: PatientProfile, actor: User, data: dict[str, Any]) -> None:
    reply = data.get("reply_to")
    if reply is not None and (
        reply.patient_id != patient.id
        or (
            actor.role != User.Role.DOCTOR
            and reply.visibility == ClinicalNote.Visibility.DOCTOR_ONLY
        )
    ):
        raise ValidationError({"reply_to": "Choose a visible note for this patient."})


@transaction.atomic
def create_note(*, patient: PatientProfile, actor: User, data: dict[str, Any]) -> ClinicalNote:
    if (
        actor.role == User.Role.CAREGIVER
        and data.get("category") != ClinicalNote.Category.CAREGIVER_FEEDBACK
    ):
        raise ValidationError({"category": "Caregivers can add caregiver feedback only."})
    if actor.role == User.Role.CAREGIVER:
        data["visibility"] = ClinicalNote.Visibility.CARE_TEAM
    validate_note_reply(patient=patient, actor=actor, data=data)
    note = ClinicalNote.objects.create(patient=patient, author=actor, **data)
    audit(
        actor, "clinical_note.created", note, patient=patient, changes={"category": note.category}
    )
    return note


@transaction.atomic
def apply_dda_override(
    *, patient: PatientProfile, doctor: User, game: GameDefinition, data: dict[str, Any]
) -> DdaOverride:
    if doctor.role != User.Role.DOCTOR:
        raise ValidationError("Only doctors can change difficulty.")
    patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
    action = data["action"]
    value = data.get("value")
    if action not in DdaOverride.Action.values:
        raise ValidationError({"action": "Choose a valid override action."})
    if not data.get("reason", "").strip():
        raise ValidationError({"reason": "A clinical reason is required."})
    state, _ = DifficultyState.objects.get_or_create(
        patient=patient, game=game, defaults={"level": game.min_level}
    )
    before = state.level
    if action == DdaOverride.Action.SET_LEVEL:
        state.level = min(
            _checked_level(game, value),
            state.cap_level or game.max_level,
            patient.max_difficulty_level or game.max_level,
        )
    elif action == DdaOverride.Action.LOCK:
        state.locked_by_doctor = True
        state.locked_by_name = doctor.display_name or doctor.username
        if value is not None:
            state.level = _checked_level(game, value)
    elif action == DdaOverride.Action.UNLOCK:
        state.locked_by_doctor = False
        state.locked_by_name = ""
    elif action == DdaOverride.Action.CAP:
        state.cap_level = _checked_level(game, value)
        state.level = min(state.level, state.cap_level)
    state.level = min(
        state.level,
        state.cap_level or game.max_level,
        patient.max_difficulty_level or game.max_level,
        game.max_level,
    )
    state.save()
    override = DdaOverride.objects.create(patient=patient, game=game, doctor=doctor, **data)
    DifficultyChange.objects.create(
        state=state,
        from_level=before,
        to_level=state.level,
        reason_code="cap" if action == DdaOverride.Action.CAP else "doctor_override",
        explanation=data["reason"],
    )
    audit(doctor, "override_dda", override, patient=patient, changes=data)
    return override


def _checked_level(game: GameDefinition, value: Any) -> int:
    if value is None or not game.min_level <= int(value) <= min(5, game.max_level):
        raise ValidationError({"value": "Choose a level within the game's range."})
    return int(value)


@transaction.atomic
def upsert_assignment(
    *,
    patient: PatientProfile,
    doctor: User,
    data: dict[str, Any],
    assignment: ExerciseAssignment | None = None,
) -> ExerciseAssignment:
    patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
    if assignment is None:
        assignment = ExerciseAssignment.objects.create(patient=patient, doctor=doctor, **data)
    else:
        for field, value in data.items():
            setattr(assignment, field, value)
        assignment.save(update_fields=[*data, "updated_at"])
    slot_times = {"morning": "09:00", "afternoon": "14:00", "evening": "18:00"}
    days = list(range(min(7, assignment.times_per_week)))
    if assignment.active:
        RoutineItem.all_objects.update_or_create(
            patient=patient,
            source=RoutineItem.Source.DOCTOR,
            source_ref=assignment.id,
            defaults={
                "title": assignment.game.name,
                "category": RoutineItem.Category.GAME,
                "time_of_day": slot_times[assignment.time_slot],
                "days_of_week": days,
                "start_date": timezone.localdate(),
                "end_date": assignment.review_date,
                "note": assignment.notes,
                "created_by": doctor,
                "deleted_at": None,
            },
        )
    else:
        RoutineItem.objects.filter(source_ref=assignment.id).delete()
    if not GameSession.objects.filter(
        patient=patient, game=assignment.game, guest_mode=False
    ).exists():
        state, _ = DifficultyState.objects.get_or_create(patient=patient, game=assignment.game)
        state.level = min(
            assignment.start_level,
            state.cap_level or assignment.game.max_level,
            patient.max_difficulty_level or assignment.game.max_level,
            assignment.game.max_level,
        )
        state.window = []
        state.save(update_fields=["level", "window", "updated_at"])
    audit(
        doctor,
        "exercise_assignment.updated",
        assignment,
        patient=patient,
        changes={
            key: str(value) if hasattr(value, "pk") or hasattr(value, "isoformat") else value
            for key, value in data.items()
        },
    )
    return assignment
