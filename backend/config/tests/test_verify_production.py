"""The production readiness command must probe safely and send only when asked."""

from io import StringIO
from unittest.mock import patch

from django.core import mail
from django.core.management import call_command
from django.test import override_settings


@override_settings(
    DEFAULT_FROM_EMAIL="smarana-test@example.com",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
def test_verify_production_checks_local_dependencies_without_sending() -> None:
    output = StringIO()
    cursor = type(
        "ProbeCursor",
        (),
        {
            "__enter__": lambda self: self,
            "__exit__": lambda self, *args: None,
            "execute": lambda self, query: None,
            "fetchone": lambda self: (1,),
        },
    )()

    with patch(
        "apps.shared.management.commands.verify_production.connection.cursor",
        return_value=cursor,
    ):
        call_command("verify_production", storage=True, smtp=True, stdout=output)

    assert "passed" in output.getvalue().lower()
    assert len(mail.outbox) == 0


@override_settings(
    DEFAULT_FROM_EMAIL="smarana-test@example.com",
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
def test_verify_production_sends_only_with_explicit_recipient() -> None:
    cursor = type(
        "ProbeCursor",
        (),
        {
            "__enter__": lambda self: self,
            "__exit__": lambda self, *args: None,
            "execute": lambda self, query: None,
            "fetchone": lambda self: (1,),
        },
    )()
    with patch(
        "apps.shared.management.commands.verify_production.connection.cursor",
        return_value=cursor,
    ):
        call_command(
            "verify_production",
            send_test_email="authorized@example.com",
            stdout=StringIO(),
        )

    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ["authorized@example.com"]
