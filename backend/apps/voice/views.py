from django.conf import settings
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .providers import ollama_readiness, safe_route


class VoiceThrottle(UserRateThrottle):
    rate = "20/min"


class RouteView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [VoiceThrottle]

    def post(self, request: Request) -> Response:
        utterance, language = request.data.get("utterance", ""), request.data.get("language", "en")
        if (
            not isinstance(utterance, str)
            or not utterance.strip()
            or len(utterance) > 500
            or not isinstance(language, str)
            or language
            not in {"en", "as", "bn", "hi", "te", "mni", "lus", "brx", "kha", "grt", "ne", "trp"}
        ):
            return Response({"detail": "Invalid voice request"}, status=400)
        if not settings.VOICE_LLM_FALLBACK and not settings.LOCAL_LLM_PROVIDER:
            return Response({"intent": None, "slots": {}, "confidence": 0})
        result = safe_route(utterance.strip(), language)
        if result is None:
            return Response({"intent": None, "slots": {}, "confidence": 0})
        return Response(
            {
                "intent": result.intent,
                "slots": result.slots,
                "confidence": result.confidence,
                "source": result.source,
            }
        )


class ReadinessView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [VoiceThrottle]

    def get(self, request: Request) -> Response:
        return Response({"local": ollama_readiness(), "cloud_enabled": settings.VOICE_LLM_FALLBACK})
