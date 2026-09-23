from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.clinical.models import ClinicalBaseline, ClinicalNote, ExerciseAssignment
from apps.clinical.selectors import doctor_dashboard
from apps.clinical.serializers import (
    ClinicalBaselineSerializer,
    ClinicalNoteSerializer,
    DdaOverrideInputSerializer,
    ExerciseAssignmentSerializer,
)
from apps.clinical.services import apply_dda_override, create_note, upsert_assignment
from apps.games.analytics import summary
from apps.games.models import DifficultyChange, DifficultyState, GameDefinition
from apps.patients.selectors import patients_for
from apps.routines.models import Medication
from apps.routines.serializers import MedicationSerializer, RoutineItemSerializer
from apps.routines.services import upsert_medication
from apps.shared.permissions import authenticated_user


class DoctorDashboard(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response(doctor_dashboard(authenticated_user(request)))


class PatientNoteList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        rows = ClinicalNote.objects.filter(patient=patient).select_related("author")
        if authenticated_user(request).role == User.Role.CAREGIVER:
            rows = rows.exclude(visibility=ClinicalNote.Visibility.DOCTOR_ONLY)
        elif authenticated_user(request).role == User.Role.PATIENT:
            rows = rows.filter(visibility=ClinicalNote.Visibility.PATIENT_VISIBLE)
        return Response(ClinicalNoteSerializer(rows, many=True).data)

    def post(self, request: Request, patient_id: str) -> Response:
        if authenticated_user(request).role not in {User.Role.CAREGIVER, User.Role.DOCTOR}:
            return Response(status=status.HTTP_404_NOT_FOUND)
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        serializer = ClinicalNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = create_note(
            patient=patient, actor=authenticated_user(request), data=dict(serializer.validated_data)
        )
        return Response(ClinicalNoteSerializer(note).data, status=status.HTTP_201_CREATED)


class PatientNoteDetail(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, patient_id: str, note_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        note = get_object_or_404(
            ClinicalNote, patient=patient, id=note_id, author=authenticated_user(request)
        )
        serializer = ClinicalNoteSerializer(note, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if authenticated_user(request).role == User.Role.CAREGIVER:
            if data.get("category", note.category) != ClinicalNote.Category.CAREGIVER_FEEDBACK:
                from rest_framework.exceptions import ValidationError

                raise ValidationError({"category": "Caregivers can add caregiver feedback only."})
            data["visibility"] = ClinicalNote.Visibility.CARE_TEAM
        from apps.clinical.services import validate_note_reply

        validate_note_reply(patient=patient, actor=authenticated_user(request), data=data)
        serializer.save()
        from apps.audit.services import audit

        audit(authenticated_user(request), "clinical_note.updated", note, patient=patient)
        return Response(serializer.data)


class PatientBaseline(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_404_NOT_FOUND)
        baseline = ClinicalBaseline.objects.filter(patient=patient).first()
        return Response(ClinicalBaselineSerializer(baseline).data if baseline else {})

    @transaction.atomic
    def put(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_404_NOT_FOUND)
        from apps.patients.models import PatientProfile

        patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
        baseline = ClinicalBaseline.objects.filter(patient=patient).first()
        serializer = ClinicalBaselineSerializer(baseline, data=request.data)
        serializer.is_valid(raise_exception=True)
        baseline = serializer.save(patient=patient, recorded_by=authenticated_user(request))
        patient.max_difficulty_level = baseline.max_difficulty_level
        patient.save(update_fields=["max_difficulty_level", "updated_at"])
        if patient.max_difficulty_level is not None:
            DifficultyState.objects.filter(
                patient=patient, level__gt=patient.max_difficulty_level
            ).update(level=patient.max_difficulty_level)
        from apps.audit.services import audit

        audit(authenticated_user(request), "clinical_baseline.updated", baseline, patient=patient)
        return Response(ClinicalBaselineSerializer(baseline).data)


class PatientMetrics(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role not in {User.Role.DOCTOR, User.Role.CAREGIVER}:
            return Response(status=status.HTTP_404_NOT_FOUND)
        try:
            window = int(request.query_params.get("window", "30"))
        except ValueError:
            window = 30
        payload = summary(patient, window)
        if authenticated_user(request).role == User.Role.CAREGIVER:
            payload = {
                "window_days": payload["window_days"],
                "domains": [
                    {"domain": row["domain"], "sessions": row["sessions"], "trend": row["trend"]}
                    for row in payload["domains"]
                ],
            }
        return Response(payload)


class PatientMedicationList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        return Response(MedicationSerializer(patient.medications.all(), many=True).data)

    def post(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = MedicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        medication = upsert_medication(
            actor=authenticated_user(request),
            patient=patient,
            fields=dict(serializer.validated_data),
        )
        return Response(MedicationSerializer(medication).data, status=status.HTTP_201_CREATED)


class PatientMedicationDetail(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, patient_id: str, medication_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_403_FORBIDDEN)
        medication = get_object_or_404(Medication, patient=patient, id=medication_id)
        serializer = MedicationSerializer(medication, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        medication = upsert_medication(
            actor=authenticated_user(request),
            patient=patient,
            medication=medication,
            fields=dict(serializer.validated_data),
        )
        return Response(MedicationSerializer(medication).data)


class PatientDifficulty(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        states = DifficultyState.objects.filter(patient=patient).select_related("game")
        return Response(
            [
                {
                    "game_key": row.game.key,
                    "game_name": row.game.name,
                    "level": row.level,
                    "locked": row.locked_by_doctor,
                    "cap_level": row.cap_level,
                    "changes": [
                        {
                            "id": str(change.id),
                            "from_level": change.from_level,
                            "to_level": change.to_level,
                            "reason_code": change.reason_code,
                            "explanation": change.explanation,
                            "session_id": str(change.session_id) if change.session_id else None,
                        }
                        for change in DifficultyChange.objects.filter(state=row)
                    ],
                }
                for row in states
            ]
        )


class PatientDifficultyOverride(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, patient_id: str, game_key: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_403_FORBIDDEN)
        game = get_object_or_404(GameDefinition, key=game_key, active=True)
        serializer = DdaOverrideInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        override = apply_dda_override(
            patient=patient,
            doctor=authenticated_user(request),
            game=game,
            data=dict(serializer.validated_data),
        )
        return Response({"id": str(override.id)}, status=status.HTTP_201_CREATED)


class PatientAssignmentList(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        rows = ExerciseAssignment.objects.filter(patient=patient).select_related("game")
        return Response(ExerciseAssignmentSerializer(rows, many=True).data)

    def post(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = ExerciseAssignmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        assignment = upsert_assignment(
            patient=patient,
            doctor=authenticated_user(request),
            data=dict(serializer.validated_data),
        )
        return Response(
            ExerciseAssignmentSerializer(assignment).data, status=status.HTTP_201_CREATED
        )


class PatientAssignmentDetail(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request: Request, patient_id: str, assignment_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        if authenticated_user(request).role != User.Role.DOCTOR:
            return Response(status=status.HTTP_403_FORBIDDEN)
        assignment = get_object_or_404(ExerciseAssignment, patient=patient, id=assignment_id)
        serializer = ExerciseAssignmentSerializer(assignment, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        assignment = upsert_assignment(
            patient=patient,
            doctor=authenticated_user(request),
            assignment=assignment,
            data=dict(serializer.validated_data),
        )
        return Response(ExerciseAssignmentSerializer(assignment).data)


class PatientDoctorRoutine(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        return Response(RoutineItemSerializer(patient.routine_items.all(), many=True).data)
