"""Production configuration; unsafe development credentials fail at startup."""

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403

DEBUG = False
LOGIN_THROTTLING = True
if len(SECRET_KEY) < 50 or SECRET_KEY.startswith(("development-", "django-insecure-")):  # noqa: F405
    raise ImproperlyConfigured("Set a random DJANGO_SECRET_KEY of at least 50 characters.")
ALLOWED_HOSTS = env.list("DJANGO_ALLOWED_HOSTS")  # noqa: F405
if not ALLOWED_HOSTS or "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("Set explicit DJANGO_ALLOWED_HOSTS.")
for variable in ("POSTGRES_PASSWORD", "MINIO_ROOT_USER", "MINIO_ROOT_PASSWORD", "REDIS_URL"):
    value = env(variable)  # noqa: F405
    if not value or value in {"smarana", "smarana_dev", "smarana_dev_password"}:
        raise ImproperlyConfigured(f"Set a production value for {variable}.")

MINIO_ENDPOINT = env("MINIO_ENDPOINT")  # noqa: F405
MINIO_BUCKET = env("MINIO_BUCKET")  # noqa: F405
MINIO_REGION = env("MINIO_REGION")  # noqa: F405
if not MINIO_ENDPOINT.startswith("https://"):
    raise ImproperlyConfigured("Set MINIO_ENDPOINT to an HTTPS private S3 endpoint.")
if not MINIO_BUCKET or MINIO_BUCKET == "smarana-media":
    raise ImproperlyConfigured("Set a non-default MINIO_BUCKET.")
AWS_S3_ENDPOINT_URL = MINIO_ENDPOINT  # noqa: F405
AWS_STORAGE_BUCKET_NAME = MINIO_BUCKET  # noqa: F405
AWS_S3_REGION_NAME = MINIO_REGION  # noqa: F405
if not env.bool("DJANGO_TRUST_PROXY", default=False):  # noqa: F405
    raise ImproperlyConfigured("Set DJANGO_TRUST_PROXY=true behind the HTTPS ingress.")

SECURE_SSL_REDIRECT = True
SECURE_REDIRECT_EXEMPT = [r"^api/v1/health/$"]
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
# Enable only behind a trusted proxy that strips incoming forwarded headers.
if env.bool("DJANGO_TRUST_PROXY", default=False):  # noqa: F405
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
CSRF_TRUSTED_ORIGINS = env.list("DJANGO_CSRF_TRUSTED_ORIGINS", default=[])  # noqa: F405
if not CSRF_TRUSTED_ORIGINS or any(
    not origin.startswith("https://") for origin in CSRF_TRUSTED_ORIGINS
):
    raise ImproperlyConfigured("Set HTTPS DJANGO_CSRF_TRUSTED_ORIGINS.")
DATABASES["default"]["CONN_MAX_AGE"] = 60  # noqa: F405
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True  # noqa: F405
DATABASES["default"]["OPTIONS"] = {  # noqa: F405
    "sslmode": env("POSTGRES_SSLMODE", default="require"),  # noqa: F405
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": env("REDIS_URL"),  # noqa: F405
    }
}
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = [  # noqa: F405
    "rest_framework.throttling.AnonRateThrottle",
    "rest_framework.throttling.UserRateThrottle",
]
REST_FRAMEWORK["DEFAULT_THROTTLE_RATES"] = {  # noqa: F405
    "anon": "30/min",
    "user": "300/min",
    "login": "10/min",
}
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = env("EMAIL_HOST")  # noqa: F405
EMAIL_PORT = env.int("EMAIL_PORT", default=587)  # noqa: F405
EMAIL_HOST_USER = env("EMAIL_HOST_USER", default="")  # noqa: F405
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD", default="")  # noqa: F405
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS", default=True)  # noqa: F405
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL", default=False)  # noqa: F405
if EMAIL_USE_TLS and EMAIL_USE_SSL:
    raise ImproperlyConfigured("EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be enabled.")
EMAIL_TIMEOUT = 10
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")  # noqa: F405
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
