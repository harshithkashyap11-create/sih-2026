from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0008_alter_user_language")]
    operations = [
        migrations.AlterField(
            model_name="user",
            name="language",
            field=models.CharField(
                max_length=8,
                default="en",
                choices=[
                    ("en", "English"),
                    ("as", "Assamese"),
                    ("bn", "Bengali"),
                    ("hi", "Hindi"),
                    ("te", "Telugu"),
                    ("mni", "Manipuri"),
                    ("lus", "Mizo"),
                    ("brx", "Bodo"),
                    ("kha", "Khasi"),
                    ("grt", "Garo"),
                    ("ne", "Nepali"),
                    ("trp", "Kokborok"),
                ],
            ),
        )
    ]
