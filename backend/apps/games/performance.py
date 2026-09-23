"""Round checkpoints use existing patient/game DDA, without double-counting sessions."""

import logging
from typing import Any

from django.conf import settings
from django.db import transaction
from rest_framework.exceptions import ValidationError

from apps.games.dda import DdaConfig, DifficultyStateData, SessionSummary, next_difficulty
from apps.games.models import DifficultyState, GameDefinition, GamePerformanceEvent
from apps.patients.models import PatientProfile

logger = logging.getLogger(__name__)

ENGINE_VERSION = "deterministic-session-v1"


@transaction.atomic
def record_performance(patient: PatientProfile, data: dict[str, Any]) -> dict[str, Any]:
    patient = PatientProfile.objects.select_for_update().get(pk=patient.pk)
    existing = GamePerformanceEvent.objects.filter(pk=data["id"]).first()
    if existing:
        if existing.patient_id != patient.id or existing.game.key != data["game_id"]:
            raise ValidationError("Event identifier is unavailable.")
        return dict(existing.decision)
    try:
        game = GameDefinition.objects.get(key=data["game_id"], active=True)
    except GameDefinition.DoesNotExist as exc:
        raise ValidationError({"game_id": "Game is unavailable."}) from exc
    if not game.min_level <= data["difficulty"] <= min(5, game.max_level):
        raise ValidationError({"difficulty": "Choose a level within the game's range."})
    state = DifficultyState.objects.filter(patient=patient, game=game).first()
    cap = min(
        value
        for value in (
            5,
            game.max_level,
            patient.max_difficulty_level,
            state.cap_level if state else None,
        )
        if value is not None
    )
    current = data["difficulty"]
    # Evaluate the cumulative checkpoint against prior *sessions*. Checkpoints never
    # append to DifficultyState.window; final session sync remains its sole writer.
    summary = SessionSummary(
        level=current,
        accuracy=data["accuracy"],
        meanReactionMs=data["reaction_time_ms"],
        mistakes=data["errors"],
        hintsUsed=data["hints_used"],
        rounds=data["rounds_completed"],
        completed=not data["early_exit"] and data["rounds_completed"] > 0,
        challengeMode=False,
        guestMode=False,
        fatigueFlagged=bool(data.get("fatigue_flags"))
        or data["session_duration_sec"] >= (patient.session_cap_minutes or 20) * 60,
    )
    try:
        result = next_difficulty(
            DifficultyStateData(
                level=current,
                window=state.window if state else [],
                lockedByDoctor=state.locked_by_doctor if state else False,
                capLevel=cap,
                minLevel=game.min_level,
                maxLevel=min(5, game.max_level),
            ),
            summary,
            DdaConfig(),
        )
    except Exception:
        logger.exception("Round DDA unavailable; holding difficulty")
        result = None
    target = result.state.level if result else current
    model_decision = None
    artifact = getattr(settings, "DDA_MODEL_ARTIFACT", "")
    if artifact:
        from apps.games.notebook_dda import recommend_for_patient

        model_decision = recommend_for_patient(patient, game, data, data["session_id"])
        if model_decision["reason"] == "model_out_of_domain" and settings.DDA_RULE_FALLBACK:
            model_decision = {
                "engine_version": ENGINE_VERSION,
                "reason": result.change.reasonCode if result else "engine_unavailable",
                "model_status": "model_out_of_domain",
            }
        else:
            target = current + model_decision["adjustment"]
    # Never increase with major errors, incomplete rounds or repeated early exits.
    if data["errors"] >= max(1, data["rounds_completed"] / 2) and target > current:
        target = current
    model_held = model_decision is not None and model_decision.get("reason") in {
        "model_unavailable",
        "model_out_of_domain",
        "cold_start",
    }
    if (
        not model_held
        and state
        and len(state.window) >= 2
        and all(
            isinstance(row, dict) and row.get("completed") is False for row in state.window[-2:]
        )
    ):
        target = max(game.min_level, current - 1)
    if state and state.locked_by_doctor:
        target = current
    if summary.fatigueFlagged:
        target = min(current, target)
    target = max(game.min_level, min(5, game.max_level, cap, target))
    # A cumulative session checkpoint may use the same prior history repeatedly.
    # Allow only one adaptive change per session, rather than promoting every round.
    earlier = GamePerformanceEvent.objects.filter(
        patient=patient, game=game, session_id=data["session_id"]
    )
    if any(row.decision.get("adjustment", 0) != 0 for row in earlier):
        target = current
    adjustment = max(-1, min(1, target - current))
    # Clinical safety bounds take precedence over the one-step adaptive limit.
    difficulty = max(game.min_level, min(cap, game.max_level, 5, current + adjustment))
    adjustment = difficulty - current
    decision = {
        "adjustment": adjustment,
        "difficulty": difficulty,
        "engine_version": ENGINE_VERSION,
        "reason": result.change.reasonCode if result else "engine_unavailable",
    }
    if model_decision is not None:
        decision.update(model_decision)
        decision["adjustment"] = adjustment
    event_data = {key: value for key, value in data.items() if key not in {"id", "session_id"}}
    event_data["timestamp"] = data["timestamp"].isoformat()
    GamePerformanceEvent.objects.create(
        id=data["id"],
        patient=patient,
        game=game,
        session_id=data["session_id"],
        performance=event_data,
        decision=decision,
    )
    return decision
