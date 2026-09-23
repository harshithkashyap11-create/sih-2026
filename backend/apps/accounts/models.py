"""Authentication and role models."""

from decimal import Decimal
from uuid import uuid4

from django.contrib.auth.hashers import check_password, make_password
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.shared.models import TimeStamped, UUIDModel


class User(AbstractUser):
    """Application user with a stable role and accessibility preferences."""

    class Role(models.TextChoices):
        PATIENT = "patient", "Patient"
        CAREGIVER = "caregiver", "Caregiver"
        DOCTOR = "doctor", "Doctor"
        ADMIN = "admin", "Admin"

    class Theme(models.TextChoices):
        LIGHT = "light", "Light"
        DARK = "dark", "Dark"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    role = models.CharField(max_length=16, choices=Role.choices)
    display_name = models.CharField(max_length=150, blank=True)
    theme = models.CharField(max_length=8, choices=Theme.choices, default=Theme.LIGHT)
    font_scale = models.DecimalField(
        max_digits=2,
        decimal_places=1,
        default=Decimal("1.0"),
        validators=[MinValueValidator(Decimal("1.0")), MaxValueValidator(Decimal("1.6"))],
    )
    language = models.CharField(
        max_length=8,
        choices=(
            ("en", "English"),
            ("as", "Assamese"),
            ("bn", "Bengali"),
            ("hi", "Hindi"),
            ("te", "Telugu"),
            ("mni", "Manipuri"),
            ("lus", "Mizo"),
            ("brx", "Bodo"),
            ("kha", "Khasi"),
            ("grt", "Garo"),
            ("ne", "Nepali"),
            ("trp", "Kokborok"),
        ),
        default="en",
    )
    is_approved = models.BooleanField(default=False)
    phone = models.CharField(max_length=32, blank=True)

    REQUIRED_FIELDS = ["role"]

    class Meta:
        ordering = ["username"]

    def __str__(self) -> str:
        return self.display_name or self.username


class PatientCredential(UUIDModel, TimeStamped):
    """Human-friendly credentials used by a patient to sign in."""

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="patient_credential",
    )
    login_id = models.CharField(max_length=32, unique=True)
    pin_hash = models.CharField(max_length=128)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    locked_until = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ["login_id"]

    def __str__(self) -> str:
        return self.login_id

    def clean(self) -> None:
        super().clean()
        if self.user_id and self.user.role != User.Role.PATIENT:
            raise ValidationError({"user": "Patient credentials require a patient user."})

    def set_pin(self, raw_pin: str) -> None:
        self.pin_hash = make_password(raw_pin, hasher="argon2")

    def check_pin(self, raw_pin: str) -> bool:
        return check_password(raw_pin, self.pin_hash)


class DeviceSession(UUIDModel, TimeStamped):
    """Track the refresh token currently issued to one user device."""

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="device_sessions",
    )
    device_id = models.CharField(max_length=255)
    refresh_token_jti = models.CharField(max_length=255, unique=True)
    last_seen_at = models.DateTimeField()
    last_push_had_rejections = models.BooleanField(default=False)

    class Meta:
        ordering = ["-last_seen_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "device_id"],
                name="unique_user_device_session",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user} on {self.device_id}"


class DoctorProfile(UUIDModel, TimeStamped):
    class VerificationStatus(models.TextChoices):
        PENDING = "pending", "Pending"
        DEMO_VERIFIED = "demo_verified", "Demo verified"
        VERIFIED = "verified", "Verified"

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="doctor_profile")
    verification_status = models.CharField(
        max_length=24,
        choices=VerificationStatus.choices,
        default=VerificationStatus.DEMO_VERIFIED,
    )
    verification_note = models.TextField(blank=True)

    def clean(self) -> None:
        super().clean()
        if self.user_id and self.user.role != User.Role.DOCTOR:
            raise ValidationError({"user": "Doctor profiles require a doctor user."})
        if (
            self.verification_status == self.VerificationStatus.VERIFIED
            and not self.verification_note
        ):
            raise ValidationError({"verification_note": "A note is required for verified status."})
