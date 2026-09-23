from uuid import UUID

from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.alerts.models import Alert, SosEvent
from apps.alerts.serializers import AlertSerializer
from apps.alerts.services import acknowledge_alert, create_sos, dismiss_alert, forward_alert
from apps.patients.selectors import patients_for
from apps.shared.permissions import authenticated_user


class PatientSosView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, patient_id: str) -> Response:
        patient = get_object_or_404(
            patients_for(authenticated_user(request)).filter(user=authenticated_user(request)),
            id=patient_id,
        )
        key = request.data.get("idempotency_key")
        if not key:
            return Response(
                {"idempotency_key": ["This field is required."]}, status=status.HTTP_400_BAD_REQUEST
            )
        event, created = create_sos(
            patient=patient,
            idempotency_key=str(key),
            location_text=str(request.data.get("location_text", "")),
        )
        return Response(
            {"id": str(event.id), "notified": event.notified},
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class SosAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request: Request, sos_id: str) -> Response:
        if authenticated_user(request).role != User.Role.CAREGIVER:
            return Response(status=status.HTTP_404_NOT_FOUND)
        event = get_object_or_404(
            SosEvent.objects.filter(
                patient__care_assignments__caregiver=authenticated_user(request),
                patient__care_assignments__active=True,
            ),
            id=sos_id,
        )
        event.acknowledged_by = authenticated_user(request)
        event.acknowledged_at = timezone.now()
        event.resolution_note = str(request.data.get("note", ""))
        event.save(
            update_fields=["acknowledged_by", "acknowledged_at", "resolution_note", "updated_at"]
        )
        event.patient.alerts.filter(evidence__sos_event_id=str(event.id)).update(
            status="acknowledged",
            acknowledged_by=authenticated_user(request),
            acknowledged_at=event.acknowledged_at,
        )
        return Response({"id": str(event.id), "status": "acknowledged"})


def scoped_alerts(request: Request) -> QuerySet[Alert]:
    return Alert.objects.filter(
        patient__in=patients_for(authenticated_user(request))
    ).select_related("forwarded_to")


class AlertListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        queryset = scoped_alerts(request)
        patient_id = request.query_params.get("patient")
        alert_status = request.query_params.get("status")
        if patient_id:
            try:
                parsed_id = UUID(patient_id)
            except (ValueError, TypeError, AttributeError):
                return Response({"patient": ["Use a valid patient UUID."]}, status=400)
            queryset = queryset.filter(patient_id=parsed_id)
        if alert_status:
            queryset = queryset.filter(status=alert_status)
        return Response(AlertSerializer(queryset, many=True).data)


class AlertActionView(APIView):
    permission_classes = [IsAuthenticated]
    action = ""

    def post(self, request: Request, alert_id: str) -> Response:
        alert = get_object_or_404(scoped_alerts(request), id=alert_id)
        note = str(request.data.get("note", ""))
        if self.action == "acknowledge":
            if authenticated_user(request).role != User.Role.CAREGIVER:
                return Response(status=status.HTTP_404_NOT_FOUND)
            acknowledge_alert(alert, authenticated_user(request), note)
        elif self.action == "forward":
            if authenticated_user(request).role != User.Role.CAREGIVER:
                return Response(status=status.HTTP_404_NOT_FOUND)
            assignment = (
                alert.patient.doctor_assignments.filter(active=True)
                .select_related("doctor")
                .first()
            )
            if assignment is None:
                return Response(
                    {"doctor": ["No doctor is currently assigned."]},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            forward_alert(alert, authenticated_user(request), assignment.doctor)
        elif self.action == "dismiss":
            if authenticated_user(request).role != User.Role.DOCTOR:
                return Response(status=status.HTTP_404_NOT_FOUND)
            dismiss_alert(alert, authenticated_user(request), note)
        return Response(AlertSerializer(alert).data)


class AlertAcknowledgeView(AlertActionView):
    action = "acknowledge"


class AlertForwardView(AlertActionView):
    action = "forward"


class AlertDismissView(AlertActionView):
    action = "dismiss"


class NotificationPreferenceListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        from apps.alerts.models import NotificationPreference
        from apps.alerts.serializers import NotificationPreferenceSerializer

        return Response(
            NotificationPreferenceSerializer(
                NotificationPreference.objects.filter(user=authenticated_user(request)), many=True
            ).data
        )

    def post(self, request: Request) -> Response:
        from apps.alerts.serializers import NotificationPreferenceSerializer

        serializer = NotificationPreferenceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        from apps.alerts.services import save_notification_preference

        row = save_notification_preference(authenticated_user(request), serializer.validated_data)
        return Response(NotificationPreferenceSerializer(row).data, status=201)


class NotificationPreferenceDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, preference_id: str) -> Response:
        from apps.alerts.models import NotificationPreference
        from apps.alerts.serializers import NotificationPreferenceSerializer

        row = get_object_or_404(
            NotificationPreference, id=preference_id, user=authenticated_user(request)
        )
        return Response(NotificationPreferenceSerializer(row).data)

    def patch(self, request: Request, preference_id: str) -> Response:
        from apps.alerts.models import NotificationPreference
        from apps.alerts.serializers import NotificationPreferenceSerializer

        row = get_object_or_404(
            NotificationPreference, id=preference_id, user=authenticated_user(request)
        )
        serializer = NotificationPreferenceSerializer(row, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        from apps.audit.services import audit

        audit(
            authenticated_user(request),
            "notification.preference",
            row,
            changes=serializer.validated_data,
        )
        return Response(serializer.data)

    def delete(self, request: Request, preference_id: str) -> Response:
        from apps.alerts.models import NotificationPreference

        row = get_object_or_404(
            NotificationPreference, id=preference_id, user=authenticated_user(request)
        )
        # Keep preference history; deleting disables this channel/rule.
        row.enabled = False
        row.save(update_fields=["enabled", "updated_at"])
        from apps.audit.services import audit

        audit(
            authenticated_user(request), "notification.preference", row, changes={"enabled": False}
        )
        return Response(status=204)


class CheckInView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request, patient_id: str) -> Response:
        from apps.alerts.models import CheckIn

        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        return Response(
            [
                {
                    "id": str(x.id),
                    "requested_by": x.requested_by.display_name,
                    "answer": getattr(getattr(x, "response", None), "answer", None),
                }
                for x in CheckIn.objects.filter(patient=patient)
                .select_related("requested_by", "response")
                .order_by("-created_at")
            ]
        )

    def post(self, request: Request, patient_id: str) -> Response:
        from apps.alerts.services import request_checkin

        if authenticated_user(request).role != User.Role.CAREGIVER:
            return Response(status=404)
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        row = request_checkin(patient, authenticated_user(request))
        return Response({"id": str(row.id)}, status=201)
