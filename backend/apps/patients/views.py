"""Assignment-scoped patient and nested-resource endpoints."""

from datetime import timedelta
from typing import Any

from django.db.models import Q
from django.db.models.query import QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from apps.accounts.models import User
from apps.audit.models import AuditEvent
from apps.patients import services
from apps.patients.media import media_url
from apps.patients.models import ConsentSettings, FamilyMember, PatientProfile
from apps.patients.selectors import patients_for
from apps.patients.serializers import (
    ConsentSettingsSerializer,
    FamilyMemberDoctorSerializer,
    FamilyMemberSerializer,
    OrientationSerializer,
    PatientCardSerializer,
    PatientProfileCaregiverSerializer,
    PatientProfileDoctorSerializer,
    ProgressSummarySerializer,
)
from apps.routines.models import Medication, Reminder, RoutineItem
from apps.routines.serializers import (
    AdherenceReminderSerializer,
    MedicationSerializer,
    ReminderResponseInputSerializer,
    ReminderResponseSerializer,
    ReminderSerializer,
    RoutineHistorySerializer,
    RoutineItemSerializer,
)
from apps.routines.services import (
    create_routine_item,
    delete_routine_item,
    materialise_reminders,
    record_response,
    update_routine_item,
    upsert_medication,
)
from apps.shared.permissions import authenticated_user, role_permission


class PatientViewSet(ReadOnlyModelViewSet[PatientProfile]):
    queryset = PatientProfile.objects.none()
    serializer_class = PatientCardSerializer
    permission_classes = [
        IsAuthenticated,
        role_permission(User.Role.CAREGIVER, User.Role.DOCTOR, User.Role.PATIENT),
    ]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self) -> QuerySet[PatientProfile]:
        if getattr(self, "swagger_fake_view", False):
            return self.queryset
        return patients_for(authenticated_user(self.request))

    def _require_primary_caregiver(self, patient: PatientProfile) -> None:
        if not patient.care_assignments.filter(
            caregiver=authenticated_user(self.request), active=True, is_primary=True
        ).exists():
            raise PermissionDenied("Only the primary caregiver can make this change.")

    @extend_schema(responses=OrientationSerializer)
    @action(detail=True, methods=["get"], url_path="orientation")
    def orientation(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del request, args, kwargs
        patient = self.get_object()
        now = timezone.localtime()
        if now.hour < 12:
            greeting_key = "morning"
        elif now.hour < 17:
            greeting_key = "afternoon"
        else:
            greeting_key = "evening"

        next_reminder = (
            patient.routine_reminders.filter(
                scheduled_at__date=now.date(),
                scheduled_at__gte=now,
                status__in=[Reminder.Status.PENDING, Reminder.Status.LATER],
            )
            .select_related("routine_item")
            .first()
        )
        members = list(patient.family_members.all())
        member = members[now.date().toordinal() % len(members)] if members else None
        family_member = None
        if member is not None:
            family_member = {
                "id": str(member.id),
                "name": member.name,
                "relationship": member.relationship_label or member.get_relationship_display(),
                "photo_url": media_url(member.photo),
            }

        payload: dict[str, object] = {
            "greeting_key": greeting_key,
            "day": now.strftime("%A"),
            "date": now.strftime("%B %-d, %Y"),
            "time": now.strftime("%-I:%M %p"),
            "home_label": patient.home_label,
            "next_activity": (
                {
                    "id": str(next_reminder.id),
                    "title": next_reminder.routine_item.title,
                    "scheduled_for": next_reminder.scheduled_at,
                }
                if next_reminder
                else None
            ),
            "family_member": family_member,
        }
        return Response(OrientationSerializer(payload).data)

    @extend_schema(responses=ProgressSummarySerializer)
    @action(detail=True, methods=["get"], url_path="progress-summary")
    def progress_summary(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del request, args, kwargs
        patient = self.get_object()
        today = timezone.localdate()
        completed = patient.routine_reminders.filter(
            scheduled_at__date=today, status=Reminder.Status.TAKEN
        ).count()
        streak = 0
        day = today
        while patient.routine_reminders.filter(
            scheduled_at__date=day, status=Reminder.Status.TAKEN
        ).exists():
            streak += 1
            day -= timedelta(days=1)
        upcoming = patient.routine_reminders.filter(
            status__in=[Reminder.Status.PENDING, Reminder.Status.LATER],
            scheduled_at__gte=timezone.now(),
        )[:3]
        payload = {
            "completed_today": completed,
            "points": completed * 10,
            "streak_days": streak,
            "favourite_games": [],
            "upcoming": [
                {
                    "id": str(item.id),
                    "title": item.routine_item.title,
                    "scheduled_at": item.scheduled_at,
                }
                for item in upcoming
            ],
        }
        return Response(ProgressSummarySerializer(payload).data)

    @action(detail=True, methods=["get", "post"], url_path="routine-items")
    def routine_items(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        patient = self.get_object()
        if request.method == "POST":
            if authenticated_user(request).role not in (User.Role.CAREGIVER, User.Role.DOCTOR):
                raise PermissionDenied("Only care-team members can add routine items.")
            serializer = RoutineItemSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            item = create_routine_item(
                actor=authenticated_user(request),
                patient=patient,
                fields=dict(serializer.validated_data),
            )
            return Response(RoutineItemSerializer(item).data, status=status.HTTP_201_CREATED)
        return Response(
            RoutineItemSerializer(
                patient.routine_items.select_related("created_by"), many=True
            ).data
        )

    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"routine-items/(?P<routine_item_id>[^/.]+)",
    )
    def routine_item_detail(
        self, request: Request, routine_item_id: str, *args: Any, **kwargs: Any
    ) -> Response:
        del args, kwargs
        patient = self.get_object()
        item = get_object_or_404(patient.routine_items.all(), id=routine_item_id)
        if authenticated_user(request).role not in (User.Role.CAREGIVER, User.Role.DOCTOR):
            raise PermissionDenied("Only care-team members can change routine items.")
        if request.method == "DELETE":
            delete_routine_item(actor=authenticated_user(request), item=item)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = RoutineItemSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        item = update_routine_item(
            actor=authenticated_user(request), item=item, fields=dict(serializer.validated_data)
        )
        return Response(RoutineItemSerializer(item).data)

    @action(
        detail=True, methods=["get"], url_path=r"routine-items/(?P<routine_item_id>[^/.]+)/history"
    )
    def routine_item_history(
        self, request: Request, routine_item_id: str, *args: Any, **kwargs: Any
    ) -> Response:
        del request, args, kwargs
        patient = self.get_object()
        item = get_object_or_404(patient.routine_items.all(), id=routine_item_id)
        rows = AuditEvent.objects.filter(
            patient=patient, target_model=item._meta.label, target_id=item.id
        ).select_related("actor")
        payload = [
            {
                "id": row.id,
                "actor_name": row.actor.display_name if row.actor else None,
                "actor_role": row.actor_role,
                "action": row.action,
                "changes": row.changes,
                "created_at": row.created_at,
            }
            for row in rows
        ]
        return Response(RoutineHistorySerializer(payload, many=True).data)

    @action(detail=True, methods=["get"], url_path="adherence")
    def adherence(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        if authenticated_user(request).role not in (User.Role.CAREGIVER, User.Role.DOCTOR):
            raise PermissionDenied("Only care-team members can view adherence.")
        try:
            days = min(31, max(1, int(request.query_params.get("days", "7"))))
        except ValueError:
            days = 7
        patient = self.get_object()
        today = timezone.localdate()
        start = today - timedelta(days=days - 1)
        reminders = (
            patient.routine_reminders.filter(
                routine_item__category=RoutineItem.Category.MEDICINE,
                scheduled_at__date__range=(start, today),
            )
            .select_related("routine_item")
            .prefetch_related("responses")
        )
        by_day = []
        counts = {choice: 0 for choice, _ in Reminder.Status.choices}
        for offset in range(days):
            day = start + timedelta(days=offset)
            day_rows = [row for row in reminders if timezone.localdate(row.scheduled_at) == day]
            for row in day_rows:
                counts[row.status] += 1
            by_day.append(
                {
                    "date": day.isoformat(),
                    "reminders": AdherenceReminderSerializer(day_rows, many=True).data,
                }
            )
        return Response({"days": by_day, "summary": counts})

    @extend_schema(parameters=[OpenApiParameter("date", OpenApiTypes.DATE)])
    @action(detail=True, methods=["get"], url_path="reminders")
    def reminders(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        patient = self.get_object()
        materialise_reminders(patient, timezone.localdate())
        queryset = patient.routine_reminders.filter(
            routine_item__deleted_at__isnull=True
        ).select_related("routine_item")
        requested_date = request.query_params.get("date")
        if requested_date:
            queryset = queryset.filter(scheduled_at__date=requested_date)
        return Response(ReminderSerializer(queryset, many=True).data)

    @action(
        detail=True,
        methods=["post"],
        url_path=r"reminders/(?P<reminder_id>[^/.]+)/respond",
    )
    def respond(self, request: Request, reminder_id: str, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        patient = self.get_object()
        if authenticated_user(request).role != User.Role.PATIENT:
            raise PermissionDenied("Only the patient can respond to reminders.")
        reminder = get_object_or_404(patient.routine_reminders.all(), id=reminder_id)
        serializer = ReminderResponseInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = record_response(reminder=reminder, **serializer.validated_data)
        return Response(ReminderResponseSerializer(response).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get", "post"], url_path="medications")
    def medications(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        patient = self.get_object()
        if request.method == "POST":
            if authenticated_user(request).role != User.Role.DOCTOR:
                raise PermissionDenied("Only doctors can prescribe medications.")
            serializer = MedicationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            medication = upsert_medication(
                actor=authenticated_user(request),
                patient=patient,
                fields=dict(serializer.validated_data),
            )
            return Response(MedicationSerializer(medication).data, status=status.HTTP_201_CREATED)
        today = timezone.localdate()
        queryset = Medication.objects.filter(patient=patient, active=True).filter(
            Q(start_date__isnull=True) | Q(start_date__lte=today),
            Q(end_date__isnull=True) | Q(end_date__gte=today),
        )
        return Response(MedicationSerializer(queryset, many=True).data)

    @action(detail=True, methods=["get", "patch"], url_path="profile")
    def profile(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        patient = self.get_object()
        if request.method == "GET":
            if authenticated_user(request).role == User.Role.CAREGIVER:
                self._require_primary_caregiver(patient)
            elif authenticated_user(request).role != User.Role.PATIENT:
                raise PermissionDenied("This profile cannot be viewed by this role.")
            return Response(PatientProfileCaregiverSerializer(patient).data)
        if authenticated_user(request).role == User.Role.CAREGIVER:
            self._require_primary_caregiver(patient)
            serializer_class: (
                type[PatientProfileCaregiverSerializer] | type[PatientProfileDoctorSerializer]
            ) = PatientProfileCaregiverSerializer
        elif authenticated_user(request).role == User.Role.DOCTOR:
            serializer_class = PatientProfileDoctorSerializer
        else:
            raise PermissionDenied("This profile cannot be changed by this role.")
        serializer = serializer_class(patient, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        patient = services.update_profile(
            actor=authenticated_user(request),
            patient=patient,
            fields=dict(serializer.validated_data),
        )
        return Response(serializer_class(patient).data)

    @action(detail=True, methods=["get", "post"], url_path="family")
    def family(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        patient = self.get_object()
        if request.method == "POST":
            if authenticated_user(request).role != User.Role.CAREGIVER:
                raise PermissionDenied("Only caregivers can add family members.")
            serializer = FamilyMemberSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            member = services.create_family_member(
                actor=authenticated_user(request),
                patient=patient,
                fields=dict(serializer.validated_data),
            )
            return Response(FamilyMemberSerializer(member).data, status=status.HTTP_201_CREATED)

        members = patient.family_members.all()
        serializer_class = (
            FamilyMemberDoctorSerializer
            if authenticated_user(request).role == User.Role.DOCTOR
            else FamilyMemberSerializer
        )
        return Response(serializer_class(members, many=True).data)

    @extend_schema(
        parameters=[OpenApiParameter("family_id", OpenApiTypes.UUID, OpenApiParameter.PATH)]
    )
    @action(
        detail=True,
        methods=["patch", "delete"],
        url_path=r"family/(?P<family_id>[^/.]+)",
    )
    def family_detail(
        self, request: Request, family_id: str, *args: Any, **kwargs: Any
    ) -> Response:
        del args, kwargs
        patient = self.get_object()
        if authenticated_user(request).role != User.Role.CAREGIVER:
            raise PermissionDenied("Only caregivers can change family members.")
        member = get_object_or_404(FamilyMember.objects.filter(patient=patient), pk=family_id)
        if request.method == "DELETE":
            services.delete_family_member(actor=authenticated_user(request), member=member)
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = FamilyMemberSerializer(member, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        member = services.update_family_member(
            actor=authenticated_user(request),
            member=member,
            fields=dict(serializer.validated_data),
        )
        return Response(FamilyMemberSerializer(member).data)

    @action(detail=True, methods=["get", "patch"], url_path="consent")
    def consent(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        del args, kwargs
        patient = self.get_object()
        if authenticated_user(request).role == User.Role.CAREGIVER:
            self._require_primary_caregiver(patient)
        elif authenticated_user(request).role != User.Role.PATIENT:
            raise PermissionDenied("Consent is controlled by the patient and primary caregiver.")
        consent, _ = ConsentSettings.objects.get_or_create(patient=patient)
        if request.method == "PATCH":
            serializer = ConsentSettingsSerializer(consent, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            consent = services.update_consent(
                actor=authenticated_user(request),
                consent=consent,
                fields=dict(serializer.validated_data),
            )
        return Response(ConsentSettingsSerializer(consent).data)

    def _wellness(self, request: Request, kind: str, log_id: str | None = None) -> Response:
        from rest_framework.exceptions import NotFound

        from apps.routines.serializers import MoodLogSerializer, SleepLogSerializer
        from apps.routines.wellness import save_log

        patient = self.get_object()
        if authenticated_user(request).role == User.Role.DOCTOR:
            consent = getattr(patient, "consent", None)
            if not consent or not consent.share_mood_with_doctor:
                raise NotFound()
            if request.method != "GET":
                raise PermissionDenied("Doctors can only read wellness logs.")
        rows = getattr(patient, f"{kind}_logs").all()
        cls = MoodLogSerializer if kind == "mood" else SleepLogSerializer
        if request.method == "GET":
            return Response(cls(rows.order_by("-created_at"), many=True).data)
        if log_id and authenticated_user(request).role != User.Role.CAREGIVER:
            raise PermissionDenied("Only caregivers can correct logs.")
        obj = get_object_or_404(rows, id=log_id) if log_id else None
        serializer = cls(obj, data=request.data, partial=bool(log_id))
        serializer.is_valid(raise_exception=True)
        if obj and "id" in serializer.validated_data:
            serializer.validated_data.pop("id")
        obj = save_log(serializer, patient, authenticated_user(request))
        return Response(serializer.data, status=200 if log_id else 201)

    @action(detail=True, methods=["get", "post"], url_path="mood-logs")
    def mood_logs(self, request: Request, **kwargs: object) -> Response:
        return self._wellness(request, "mood")

    @action(detail=True, methods=["get", "post"], url_path="sleep-logs")
    def sleep_logs(self, request: Request, **kwargs: object) -> Response:
        return self._wellness(request, "sleep")

    @action(detail=True, methods=["patch"], url_path=r"mood-logs/(?P<log_id>[^/.]+)")
    def mood_log_detail(self, request: Request, log_id: str, **kwargs: object) -> Response:
        return self._wellness(request, "mood", log_id)

    @action(detail=True, methods=["patch"], url_path=r"sleep-logs/(?P<log_id>[^/.]+)")
    def sleep_log_detail(self, request: Request, log_id: str, **kwargs: object) -> Response:
        return self._wellness(request, "sleep", log_id)

    @action(detail=True, methods=["get"], url_path="timeline")
    def timeline(self, request: Request, **kwargs: object) -> Response:
        from apps.patients.timeline import timeline

        if authenticated_user(request).role != User.Role.CAREGIVER:
            raise PermissionDenied("Caregiver access required.")
        return Response(timeline(self.get_object(), request.query_params))

    @action(detail=True, methods=["get"], url_path="care-team")
    def care_team(self, request: Request, **kwargs: object) -> Response:
        patient = self.get_object()
        if authenticated_user(request).role not in (User.Role.CAREGIVER, User.Role.DOCTOR):
            raise PermissionDenied("Care team access required.")
        members = [
            a.caregiver
            for a in patient.care_assignments.filter(active=True).select_related("caregiver")
        ]
        members += [
            a.doctor
            for a in patient.doctor_assignments.filter(active=True).select_related("doctor")
        ]
        return Response(
            [
                {
                    "id": str(u.id),
                    "name": u.display_name,
                    "role": u.role,
                    "phone": u.phone,
                    "email": u.email,
                }
                for u in members
            ]
        )

    @action(detail=True, methods=["get"], url_path="primary-contact")
    def primary_contact(self, request: Request, **kwargs: object) -> Response:
        patient = self.get_object()
        assignment = (
            patient.care_assignments.filter(active=True, is_primary=True)
            .select_related("caregiver")
            .first()
        )
        if assignment is None:
            return Response(None)
        return Response(
            {"name": assignment.caregiver.display_name, "phone": assignment.caregiver.phone}
        )

    @action(detail=True, methods=["post"], url_path="routine-conflicts")
    def routine_conflicts(self, request: Request, **kwargs: object) -> Response:
        from apps.routines.conflicts import conflicts

        patient = self.get_object()
        if authenticated_user(request).role not in (User.Role.CAREGIVER, User.Role.DOCTOR):
            raise PermissionDenied("Care team access required.")
        item = (
            get_object_or_404(patient.routine_items.all(), id=request.data["item_id"])
            if request.data.get("item_id")
            else None
        )
        serializer = RoutineItemSerializer(item, data=request.data, partial=bool(item))
        serializer.is_valid(raise_exception=True)
        return Response({"warnings": conflicts(patient, serializer.validated_data, item)})
