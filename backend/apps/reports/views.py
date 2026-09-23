from datetime import date, timedelta

from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import User
from apps.patients.selectors import patients_for
from apps.reports.services import emergency_pdf, report_pdf
from apps.shared.permissions import authenticated_user


class ReportView(APIView):
    permission_classes = [IsAuthenticated]
    emergency = False

    def get(self, request: Request, patient_id: str) -> HttpResponse | Response:
        if authenticated_user(request).role not in {User.Role.CAREGIVER, User.Role.DOCTOR}:
            return Response(status=404)
        patient = get_object_or_404(patients_for(authenticated_user(request)), id=patient_id)
        default_end = timezone.localdate()
        default_start = default_end - timedelta(days=29)
        try:
            start = parse_date(request.query_params.get("from", default_start.isoformat()))
            end = parse_date(request.query_params.get("to", default_end.isoformat()))
        except (ValueError, TypeError):
            return Response({"detail": "Use valid dates in YYYY-MM-DD format."}, status=400)
        if (
            not start
            or not end
            or start <= date.min
            or end >= date.max
            or start > end
            or (end - start).days > 365
        ):
            return Response({"detail": "Choose a period of up to 366 days."}, status=400)
        pdf = (
            emergency_pdf(patient, authenticated_user(request))
            if self.emergency
            else report_pdf(patient, authenticated_user(request), start, end)
        )
        response = HttpResponse(pdf, content_type="application/pdf")
        kind = "emergency-card" if self.emergency else "report"
        response["Content-Disposition"] = f'attachment; filename="smarana-{kind}-{patient.id}.pdf"'
        response["Cache-Control"] = "private, no-store"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class EmergencyCardView(ReportView):
    emergency = True
