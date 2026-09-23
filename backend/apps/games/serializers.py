from rest_framework import serializers

from apps.games.models import GameDefinition


class GameDefinitionSerializer(serializers.ModelSerializer[GameDefinition]):
    class Meta:
        model = GameDefinition
        fields = ["id", "key", "name", "cognitive_domains", "min_level", "max_level", "is_regional"]


class GameSessionInputSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.UUIDField(required=False)
    game_key = serializers.SlugField()
    seed = serializers.CharField(max_length=64)
    level = serializers.IntegerField(min_value=1, max_value=5)
    metrics = serializers.JSONField()
    challenge_mode = serializers.BooleanField(default=False)
    guest_mode = serializers.BooleanField(default=False)
    started_at = serializers.DateTimeField()
    ended_at = serializers.DateTimeField()

    def validate_game_key(self, value: str) -> str:
        if not GameDefinition.objects.filter(key=value, active=True).exists():
            raise serializers.ValidationError("Game is unavailable.")
        return value

    def validate_metrics(self, value: object) -> dict[str, object]:
        if not isinstance(value, dict):
            raise serializers.ValidationError("Expected an object.")
        return value


class PerformanceEventSerializer(serializers.Serializer[dict[str, object]]):
    id = serializers.UUIDField()
    session_id = serializers.UUIDField()
    game_id = serializers.SlugField()
    difficulty = serializers.IntegerField(min_value=1, max_value=5)
    accuracy = serializers.FloatField(min_value=0, max_value=1)
    reaction_time_ms = serializers.FloatField(min_value=0)
    errors = serializers.IntegerField(min_value=0)  # type: ignore[assignment]  # DRF removes declared fields from class attributes.
    hints_used = serializers.IntegerField(min_value=0)
    completed = serializers.BooleanField()
    early_exit = serializers.BooleanField()
    session_duration_sec = serializers.FloatField(min_value=0)
    rounds_completed = serializers.IntegerField(min_value=0)
    timestamp = serializers.DateTimeField()
    fatigue_flags = serializers.ListField(
        child=serializers.ChoiceField(
            choices=["consecutive_mistakes", "slow_reactions", "rapid_taps", "session_cap"]
        ),
        required=False,
        default=list,
        max_length=4,
    )

    def validate(self, attrs: dict[str, object]) -> dict[str, object]:
        import math

        for key in ("accuracy", "reaction_time_ms", "session_duration_sec"):
            if not math.isfinite(float(str(attrs[key]))):
                raise serializers.ValidationError({key: "Use a finite number."})
        if attrs["completed"] and attrs["early_exit"]:
            raise serializers.ValidationError("A completed event cannot be an early exit.")
        return attrs
