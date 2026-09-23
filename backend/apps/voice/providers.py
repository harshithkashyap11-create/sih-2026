import json
import logging
import math
import re
import shutil
import socket
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol, TypeGuard
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from django.conf import settings

ALLOWED_INTENTS = {
    "open_section",
    "start_game",
    "medicines_today",
    "next_activity",
    "set_reminder",
    "call_person",
    "read_this",
    "speak_slowly",
    "speak_normally",
    "help",
    "sos",
    "switch_language",
    "stop_game",
    "stop_listening",
    "time_query",
    "date_query",
    "general_chat",
}


@dataclass(frozen=True)
class ProviderResult:
    intent: str
    slots: dict[str, str]
    confidence: float
    source: str = "CLOUD_LLM"


class VoiceProvider(Protocol):
    def route(self, utterance: str, language: str) -> ProviderResult | None: ...


class DisabledProvider:
    def route(self, utterance: str, language: str) -> ProviderResult | None:
        return None


class HttpJsonProvider:
    """Optional configured command router; no patient context or secrets in payload."""

    def route(self, utterance: str, language: str) -> ProviderResult | None:
        endpoint = getattr(settings, "VOICE_ROUTER_ENDPOINT", "")
        if not endpoint:
            return None
        headers = {"Content-Type": "application/json"}
        token = getattr(settings, "VOICE_ROUTER_TOKEN", "")
        if token:
            headers["Authorization"] = f"Bearer {token}"
        request = Request(
            endpoint,
            data=json.dumps({"utterance": utterance, "language": language}).encode(),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=3) as response:
                # Limit the reply so an accidental large response cannot exhaust memory.
                raw = response.read(16_385)
                if len(raw) > 16_384:
                    return None
                data = json.loads(raw)
            if not isinstance(data, dict):
                return None
            intent, slots, confidence = (
                data.get("intent"),
                data.get("slots"),
                data.get("confidence"),
            )
            if (
                not isinstance(intent, str)
                or not isinstance(slots, dict)
                or not isinstance(confidence, (int, float))
            ):
                return None
            typed_slots: dict[str, str] = {}
            for key, value in slots.items():
                if not isinstance(key, str) or not isinstance(value, str):
                    return None
                typed_slots[key] = value
            return ProviderResult(intent, typed_slots, float(confidence))
        except Exception:
            logging.getLogger(__name__).warning("voice_router_unavailable")
            return None


SECTIONS = {
    "home",
    "games",
    "reminders",
    "routine",
    "profile",
    "settings",
    "progress",
    "caregiver",
    "people",
    "memories",
    "medicines",
    "calm-time",
    "sleep",
}
GAME_CONTRACT = json.loads((Path(settings.BASE_DIR).parent / "shared" / "games.json").read_text())
GAMES = {game["id"] for game in GAME_CONTRACT if game["enabled"]}


def ollama_readiness() -> dict[str, object]:
    """Bounded diagnostics; installation can only be assessed on this host."""
    if getattr(settings, "LOCAL_LLM_PROVIDER", "") != "ollama":
        return {"status": "disabled", "installed": None}
    base_url = settings.LOCAL_LLM_URL.rstrip("/")
    installed = (
        bool(shutil.which("ollama"))
        if urlparse(base_url).hostname in {"localhost", "127.0.0.1", "::1"}
        else None
    )
    try:
        with urlopen(
            base_url + "/api/tags", timeout=min(settings.LOCAL_LLM_TIMEOUT, 3)
        ) as response:
            raw = response.read(65_537)
        if len(raw) > 65_536:
            return {"status": "invalid_response", "installed": installed}
        models = json.loads(raw)["models"]
        if not isinstance(models, list) or not all(isinstance(item, dict) for item in models):
            return {"status": "invalid_response", "installed": installed}
        wanted = settings.LOCAL_LLM_MODEL
        names = {item.get("name") for item in models if isinstance(item.get("name"), str)}
        available = wanted in names or (":" not in wanted and wanted + ":latest" in names)
        return {
            "status": "ready" if available else "model_missing",
            "installed": installed,
            "model": wanted,
        }
    except TimeoutError:
        return {"status": "timeout", "installed": installed}
    except URLError as error:
        if isinstance(error.reason, (TimeoutError, socket.timeout)):
            return {"status": "timeout", "installed": installed}
        return {
            "status": "not_installed" if installed is False else "service_unavailable",
            "installed": installed,
        }
    except (ValueError, KeyError, TypeError):
        return {"status": "invalid_response", "installed": installed}


def short_chat_response(text: str) -> str | None:
    """Extract a brief complete-sentence summary, never truncate action details."""
    text = " ".join(text.split())
    words = max(10, min(getattr(settings, "VOICE_RESPONSE_MAX_WORDS", 60), 100))
    chars = max(100, min(getattr(settings, "VOICE_RESPONSE_MAX_CHARS", 600), 600))
    if re.search(r"https?://|```|<script", text, re.I):
        return None
    sentences = re.split(r"(?<=[.!?।])\s+", text)
    selected: list[str] = []
    for sentence in sentences[:3]:
        candidate = " ".join([*selected, sentence])
        if len(candidate) > chars or len(candidate.split()) > words:
            break
        selected.append(sentence)
    return " ".join(selected) or None


def valid_result(result: ProviderResult | None) -> TypeGuard[ProviderResult]:
    import re

    if (
        result is None
        or not isinstance(result.intent, str)
        or result.intent not in ALLOWED_INTENTS
        or isinstance(result.confidence, bool)
        or not isinstance(result.confidence, (int, float))
        or not math.isfinite(result.confidence)
        or not 0.8 <= result.confidence <= 1
    ):
        return False
    if not isinstance(result.slots, dict) or not all(
        isinstance(k, str) and isinstance(v, str) and len(v) <= 2000
        for k, v in result.slots.items()
    ):
        return False
    slots = result.slots
    if result.intent == "open_section":
        return slots.get("section") in SECTIONS
    if result.intent == "start_game":
        return not slots.get("game") or slots["game"] in GAMES
    if result.intent == "set_reminder":
        if "date" in slots:
            from datetime import date

            try:
                if date.fromisoformat(slots["date"]).isoformat() != slots["date"]:
                    return False
            except ValueError:
                return False
        return bool(
            slots.get("title", "").strip()
            and re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", slots.get("time", ""))
        )
    if result.intent == "switch_language":
        return slots.get("language") in {
            "en",
            "as",
            "bn",
            "hi",
            "te",
            "mni",
            "lus",
            "brx",
            "kha",
            "grt",
            "ne",
            "trp",
        }
    if result.intent == "call_person":
        return bool(slots.get("name", "").strip())
    if result.intent == "general_chat":
        return bool(slots.get("response", "").strip())
    return True


class OllamaProvider:
    """A bounded local inference request, never executable browser instructions."""

    def route(self, utterance: str, language: str) -> ProviderResult | None:
        if getattr(settings, "LOCAL_LLM_PROVIDER", "") != "ollama":
            return None
        prompt = (
            "You are Smarana, a calm conversational companion. Return JSON only: "
            "intent=general_chat, confidence (0 to 1), slots.response (a string). "
            "You cannot navigate, start games, create reminders, change medicines, "
            "make calls or trigger emergencies. Never claim you performed an action. "
            "Answer in at most 3 short sentences and "
            f"{getattr(settings, 'VOICE_RESPONSE_MAX_WORDS', 60)} words. "
            "Use simple, friendly language. You have no current activity or patient context; "
            "ask which activity the person means rather than inventing its details. "
            "Never give medical diagnoses or treatment advice. "
            "Never return code, URLs or instructions to execute. Use low confidence if uncertain. "
            f"Reply in language {language}."
        )
        payload = {
            "model": settings.LOCAL_LLM_MODEL,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0, "num_predict": 350},
            "messages": [
                {"role": "system", "content": prompt},
                {"role": "user", "content": utterance},
            ],
        }
        request = Request(
            settings.LOCAL_LLM_URL.rstrip("/") + "/api/chat",
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(request, timeout=settings.LOCAL_LLM_TIMEOUT) as response:
                raw = response.read(16385)
            if len(raw) > 16384:
                return None
            data = json.loads(json.loads(raw)["message"]["content"])
            if not isinstance(data, dict):
                return None
            intent, slots, confidence = (
                data.get("intent"),
                data.get("slots"),
                data.get("confidence"),
            )
            if (
                not isinstance(intent, str)
                or not isinstance(slots, dict)
                or not all(isinstance(k, str) and isinstance(v, str) for k, v in slots.items())
                or not isinstance(confidence, (int, float))
                or isinstance(confidence, bool)
            ):
                return None
            result = ProviderResult(intent, slots, float(confidence), "LOCAL_LLM")
            return result if valid_result(result) else None
        except TimeoutError:
            logging.getLogger(__name__).warning("local_voice_timeout")
            return None
        except HTTPError as error:
            logging.getLogger(__name__).warning("local_voice_http_error status=%s", error.code)
            return None
        except URLError:
            logging.getLogger(__name__).warning("local_voice_connection_failed")
            return None
        except Exception:
            logging.getLogger(__name__).warning("local_voice_invalid_response")
            return None


class HybridProvider:
    def route(self, utterance: str, language: str) -> ProviderResult | None:
        result = OllamaProvider().route(utterance, language)
        if valid_result(result) and result.intent == "general_chat":
            return result
        if getattr(settings, "VOICE_LLM_FALLBACK", False):
            return HttpJsonProvider().route(utterance, language)
        return None


provider: VoiceProvider = HybridProvider()


def safe_route(utterance: str, language: str) -> ProviderResult | None:
    try:
        result = provider.route(utterance[:500], language)
    except Exception:
        logging.getLogger(__name__).warning("voice_provider_failed")
        return None
    # Defense in depth: neither local nor cloud output can execute application intents.
    if not valid_result(result) or result.intent != "general_chat":
        return None
    response = short_chat_response(result.slots["response"])
    return (
        ProviderResult("general_chat", {"response": response}, result.confidence, result.source)
        if response
        else None
    )
