"""Role-specific patient API shapes."""

from datetime import timedelta

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.patients.media import media_url
from apps.patients.models import ConsentSettings, FamilyMember, PatientProfile


class PatientCardSerializer(serializers.ModelSerializer[PatientProfile]):
    name = serializers.CharField(source="user.display_name", read_only=True)
    age = serializers.SerializerMethodField()
    language = serializers.SerializerMethodField()
    primary_caregiver_name = serializers.CharField(read_only=True, allow_null=True)
    last_active_at = serializers.DateTimeField(read_only=True, allow_null=True)
    open_alert_count = serializers.IntegerField(read_only=True)
    is_primary = serializers.BooleanField(read_only=True, default=False)
    pending_on_device = serializers.SerializerMethodField()

    class Meta:
        model = PatientProfile
        fields = (
            "id",
            "name",
            "age",
            "language",
            "primary_caregiver_name",
            "last_active_at",
            "open_alert_count",
            "is_primary",
            "pending_on_device",
            "session_cap_minutes",
            "max_difficulty_level",
            "region",
        )
        read_only_fields = fields

    @extend_schema_field(serializers.IntegerField(allow_null=True))
    def get_age(self, obj: PatientProfile) -> int | None:
        if obj.date_of_birth is None:
            return None
        today = timezone.localdate()
        return (
            today.year
            - obj.date_of_birth.year
            - ((today.month, today.day) < (obj.date_of_birth.month, obj.date_of_birth.day))
        )

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_language(self, obj: PatientProfile) -> str | None:
        return obj.user.language

    @extend_schema_field(serializers.BooleanField())
    def get_pending_on_device(self, obj: PatientProfile) -> bool:
        last_active_at = getattr(obj, "last_active_at", None)
        return bool(getattr(obj, "last_push_had_rejections", False)) or (
            last_active_at is None or last_active_at < timezone.now() - timedelta(hours=24)
        )


CAREGIVER_PROFILE_FIELDS = (
    "date_of_birth",
    "gender",
    "region",
    "cultural_notes",
    "home_label",
    "known_places",
    "life_events",
    "work_history",
    "favourite_songs",
    "hobbies",
    "happy_things",
    "soothing_prompts",
    "accessibility",
    "challenge_mode_default",
)


class PatientProfileCaregiverSerializer(serializers.ModelSerializer[PatientProfile]):
    language = serializers.CharField(source="user.language")

    class Meta:
        model = PatientProfile
        fields = (*CAREGIVER_PROFILE_FIELDS, "language")


class PatientProfileDoctorSerializer(serializers.ModelSerializer[PatientProfile]):
    max_difficulty_level = serializers.IntegerField(
        min_value=1, max_value=5, allow_null=True, required=False
    )

    class Meta:
        model = PatientProfile
        fields = ("session_cap_minutes", "max_difficulty_level")


class FamilyMemberSerializer(serializers.ModelSerializer[FamilyMember]):
    photo_url = serializers.SerializerMethodField()
    photo = serializers.ImageField(write_only=True, required=False)

    class Meta:
        model = FamilyMember
        fields = (
            "id",
            "name",
            "relationship",
            "relationship_label",
            "photo",
            "photo_url",
            "phone",
            "is_emergency_contact",
            "linked_user",
            "order",
        )
        read_only_fields = ("id", "photo_url")

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_photo_url(self, obj: FamilyMember) -> str | None:
        return media_url(obj.photo)


class FamilyMemberDoctorSerializer(serializers.ModelSerializer[FamilyMember]):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = FamilyMember
        fields = ("id", "name", "relationship", "relationship_label", "photo_url", "order")
        read_only_fields = fields

    @extend_schema_field(serializers.URLField(allow_null=True))
    def get_photo_url(self, obj: FamilyMember) -> str | None:
        return media_url(obj.photo)


class ConsentSettingsSerializer(serializers.ModelSerializer[ConsentSettings]):
    class Meta:
        model = ConsentSettings
        fields = (
            "share_memories_with_doctor",
            "use_memories_in_quiz",
            "share_mood_with_doctor",
            "share_audio_with_doctor",
        )


class OrientationSerializer(serializers.Serializer[dict[str, object]]):
    greeting_key = serializers.ChoiceField(choices=("morning", "afternoon", "evening"))
    day = serializers.CharField()
    date = serializers.CharField()
    time = serializers.CharField()
    home_label = serializers.CharField(allow_blank=True)
    next_activity = serializers.DictField(allow_null=True)
    family_member = serializers.DictField(allow_null=True)


class ProgressSummarySerializer(serializers.Serializer[dict[str, object]]):
    completed_today = serializers.IntegerField()
    points = serializers.IntegerField()
    streak_days = serializers.IntegerField()
    favourite_games = serializers.ListField(child=serializers.CharField())
    upcoming = serializers.ListField(child=serializers.DictField())
