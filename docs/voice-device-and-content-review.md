# Device voice and content review worksheet

This is a required staging sign-off, not an automated unit-test substitute.
Use fictional data only and attach the browser/device version and date.

## Voice matrix

| Device/browser | Language | Mic permission | Spoken phrase/transcript | TTS voice/locale | Interrupt/retry | Result | Reviewer/date |
|---|---|---|---|---|---|---|---|
| Android / Chrome | en-IN |  |  |  |  |  |  |
| Android / Chrome | as-IN or bn-IN fallback |  |  |  |  |  |  |
| iOS / Safari | en-IN |  |  |  |  |  |  |
| iOS / Safari | as-IN or bn-IN fallback |  |  |  |  |  |  |

For each row, verify: permission denial produces a typed fallback; a real phrase
routes to the intended safe action; actions requiring confirmation cannot execute
from an unconfirmed utterance; slow speech finishes; cancelling speech does not
leave the microphone stuck; and a second turn does not replay the first turn.

## Translation/content matrix

| Language/region | Patient UI strings | Game instructions | Regional pack | Native speaker | Clinical reviewer | Rights/attribution | Status/date |
|---|---|---|---|---|---|---|---|
| Assamese / Assam |  |  |  |  |  |  |  |
| Bengali / Assam/Meghalaya |  |  |  |  |  |  |  |
| Hindi / India |  |  |  |  |  |  |  |

Do not mark a pack `published` until the native-speaker, clinical, and rights
columns have named reviewers and dates. If a language is incomplete, leave it
unavailable; never substitute English while presenting it as translated.
