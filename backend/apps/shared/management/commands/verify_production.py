"""Verify external production dependencies without mutating patient data."""

from __future__ import annotations

from argparse import ArgumentParser
from uuid import uuid4

from django.conf import settings
from django.core.cache import cache
from django.core.checks import run_checks
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.mail import EmailMessage, get_connection
from django.core.management.base import BaseCommand, CommandError
from django.db import connection


class Command(BaseCommand):
    help = "Verify production configuration and optional external service probes."

    def add_arguments(self, parser: ArgumentParser) -> None:
        parser.add_argument(
            "--storage",
            action="store_true",
            help="Write, read, and delete a short-lived probe object in the default storage.",
        )
        parser.add_argument(
            "--smtp",
            action="store_true",
            help="Open and close an SMTP connection without sending a message.",
        )
        parser.add_argument(
            "--send-test-email",
            metavar="RECIPIENT",
            help="Send one explicit test message to RECIPIENT after the SMTP probe.",
        )

    def handle(self, *args: object, **options: object) -> None:
        del args
        failures: list[str] = []
        self._check_django(failures)
        self._check_database(failures)
        self._check_cache(failures)

        if options["storage"]:
            self._check_storage(failures)
        if options["smtp"] or options["send_test_email"]:
            self._check_smtp(failures, options["send_test_email"])

        if failures:
            raise CommandError("Production readiness failed:\n- " + "\n- ".join(failures))
        self.stdout.write(self.style.SUCCESS("Production readiness checks passed."))

    def _check_django(self, failures: list[str]) -> None:
        errors = [check for check in run_checks(tags=["deploy"]) if check.is_serious()]
        if errors:
            failures.extend(f"Django: {check.msg}" for check in errors)

    def _check_database(self, failures: list[str]) -> None:
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                if cursor.fetchone() != (1,):
                    failures.append("database: SELECT 1 returned an unexpected result")
        except Exception as exc:  # pragma: no cover - provider-specific errors
            failures.append(f"database: {exc}")

    def _check_cache(self, failures: list[str]) -> None:
        key = f"smarana:readiness:{uuid4().hex}"
        try:
            cache.set(key, "ok", timeout=30)
            if cache.get(key) != "ok":
                failures.append("cache: probe value could not be read back")
        except Exception as exc:  # pragma: no cover - provider-specific errors
            failures.append(f"cache: {exc}")
        finally:
            try:
                cache.delete(key)
            except Exception:
                pass

    def _check_storage(self, failures: list[str]) -> None:
        storage = storages["default"]
        name = f"healthchecks/{uuid4().hex}.txt"
        try:
            storage.save(name, ContentFile(b"smarana production readiness probe\n"))
            if not storage.exists(name):
                failures.append("storage: probe object was not visible after upload")
            else:
                with storage.open(name, "rb") as probe:
                    if probe.read() != b"smarana production readiness probe\n":
                        failures.append("storage: probe object contents did not round-trip")
        except Exception as exc:  # pragma: no cover - provider-specific errors
            failures.append(f"storage: {exc}")
        finally:
            try:
                storage.delete(name)
            except Exception:
                pass

    def _check_smtp(self, failures: list[str], recipient: object) -> None:
        try:
            connection = get_connection(fail_silently=False)
            connection.open()
            if recipient:
                message = EmailMessage(
                    subject="Smārana production readiness test",
                    body="This is an explicit production readiness test message.",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[str(recipient)],
                    connection=connection,
                )
                if message.send(fail_silently=False) != 1:
                    failures.append("smtp: test message was not accepted")
            connection.close()
        except Exception as exc:  # pragma: no cover - provider-specific errors
            failures.append(f"smtp: {exc}")
