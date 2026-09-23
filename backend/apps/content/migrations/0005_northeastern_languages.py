from django.apps.registry import Apps
from django.db import migrations
from django.db.backends.base.schema import BaseDatabaseSchemaEditor


def add_languages(apps: Apps, schema_editor: BaseDatabaseSchemaEditor) -> None:
    language = apps.get_model("content", "Language")
    for code, name, native in [
        ("brx", "Bodo", "बड़ो"),
        ("kha", "Khasi", "Khasi"),
        ("grt", "Garo", "Garo"),
        ("ne", "Nepali", "नेपाली"),
        ("trp", "Kokborok", "Kokborok"),
    ]:
        language.objects.using(schema_editor.connection.alias).update_or_create(
            code=code,
            defaults={
                "name": name,
                "native_name": native,
                "enabled": True,
                "tts_locale": f"{code}-IN",
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("content", "0004_telugu_northeast"),
        ("accounts", "0009_northeastern_languages"),
    ]
    operations = [migrations.RunPython(add_languages, migrations.RunPython.noop)]
