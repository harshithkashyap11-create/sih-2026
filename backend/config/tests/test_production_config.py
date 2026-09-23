"""Production secret defaults must fail closed before the app can start."""

import os
import subprocess
import sys

import pytest


@pytest.mark.parametrize("secret", ["", "short", "development-only-change-me-at-least-32-bytes"])
def test_production_refuses_unsafe_signing_secret(secret: str) -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.prod"],
        env={**os.environ, "DJANGO_SECRET_KEY": secret},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode != 0
    assert "random DJANGO_SECRET_KEY" in result.stderr


def _valid_production_environment() -> dict[str, str]:
    return {
        "DJANGO_SECRET_KEY": "x" * 64,
        "DJANGO_ALLOWED_HOSTS": "care.example.com",
        "DJANGO_CSRF_TRUSTED_ORIGINS": "https://care.example.com",
        "DJANGO_TRUST_PROXY": "true",
        "POSTGRES_PASSWORD": "a-real-password",
        "MINIO_ROOT_USER": "s3-app-user",
        "MINIO_ROOT_PASSWORD": "a-real-s3-password",
        "MINIO_BUCKET": "smarana-media-production",
        "MINIO_ENDPOINT": "https://s3.example.com",
        "MINIO_REGION": "us-east-1",
        "REDIS_URL": "rediss://redis.example.com:6380/0",
        "EMAIL_HOST": "smtp.example.com",
        "EMAIL_PORT": "587",
        "EMAIL_USE_TLS": "true",
        "EMAIL_USE_SSL": "false",
        "DEFAULT_FROM_EMAIL": "no-reply@example.com",
    }


def test_production_accepts_explicit_external_service_configuration() -> None:
    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.prod"],
        env={**os.environ, **_valid_production_environment()},
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr


def test_production_rejects_non_https_storage_endpoint() -> None:
    environment = _valid_production_environment()
    environment["MINIO_ENDPOINT"] = "http://minio.example.com"
    result = subprocess.run(
        [sys.executable, "-c", "import config.settings.prod"],
        env={**os.environ, **environment},
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode != 0
    assert "HTTPS private S3 endpoint" in result.stderr
