# 08 — Games Catalog (21 games)

The runtime source of truth is `frontend/src/games/registry.ts`, backed by
`shared/games.json`. The catalogue currently contains 12 integrated games and
9 regional/personal modules. All use a shared session host for timing, metrics,
fatigue handling, dynamic difficulty adjustment (DDA), supportive feedback and
offline persistence.

Regional modules implement this interface:

```ts
interface GameModule {
  key: string;
  domains: CognitiveDomain[];
  buildRound(level: number, rng: SeededRng, content: ContentPack): RoundSpec;
  Render: React.FC<{ round: RoundSpec; onAnswer(a: Answer): void; onHint(): void }>;
  score(round: RoundSpec, answer: Answer): { correct: boolean; partial?: number };
  roundsForLevel(level: number): number;
}
```

RNG is seeded per session so a resumed session regenerates identical rounds.

Live difficulty is bounded to levels 1–5. Historical module logic can still build
levels 6–10 for compatibility tests, but those levels are not exposed by the
current API or patient UI.

## Integrated games

| # | Key | Name | Primary domain | Main difficulty knobs |
|---|---|---|---|---|
| 1 | `sequence_recall` | Sequence Recall | memory | sequence length, distractors, observation time |
| 2 | `memory_match` | Memory Match | memory | pair count, preview time, visual similarity |
| 3 | `find_the_change` | Find the Change | attention | object count, change count, observation time |
| 4 | `object_sorting` | Object Sorting | reasoning | item count, categories, distractors |
| 5 | `daily_routine` | Daily Routine Builder | reasoning | step count, ordering complexity, distractions |
| 6 | `word_recall` | Word Recall | memory | word count, recall mode, cues |
| 7 | `visual_search` | Visual Search | attention | grid size, similarity, target count |
| 8 | `pattern_completion` | Pattern Completion | reasoning | rule complexity, choices, support |
| 9 | `spatial_recall` | Spatial Recall | visuospatial | grid size, object count, delay |
| 10 | `attention_tap` | Attention Tap | attention | stimulus count, target frequency, inhibition |
| 11 | `association_game` | Association Game | associative memory | pair count, semantic distractors, cues |
| 12 | `personal_memory` | Personal Memory Recall | personal memory | recognition/recall mode, context, hints |

## Regional and personal-content modules

| # | Key | Name | Domains | Required content |
|---|---|---|---|---|
| 13 | `tea_garden_attention` | Tea Garden Attention | attention | regional scene/items |
| 14 | `bihu_rhythm_recall` | Bihu Rhythm Recall | memory, sequencing | rhythm/audio cues |
| 15 | `daily_life_sequencing` | Daily Life Sequencing | routine, sequencing | regional activities |
| 16 | `familiar_place_recall` | Familiar Place Recall | recognition, memory | regional or patient-known places |
| 17 | `who_is_this` | Who Is This? | recognition | patient family photos |
| 18 | `word_pairs` | Word Pairs | memory, language | language-pack words |
| 19 | `festival_calendar` | Festival Calendar | recognition, memory | festival season/month/state metadata |
| 20 | `sound_match` | Sound Match | recognition, memory | paired audio and images |
| 21 | `spot_the_change` | Spot the Change | attention | same-scene difference variants |

## Metrics every game emits (validated by `GameDefinition.metrics_schema`)

`accuracy, mean_reaction_ms, mistakes, hints_used, rounds, duration_ms, completed, abandoned_reason, fatigue_flags[]`. Optional per-game extras go into `raw_events` (compact, ≤ 20 KB).

## Copy rules inside games
- Correct: "Yes!", "Well done", "That's right" with a soft chime.
- Incorrect: "It's here" (highlight correct) — never "wrong", no red, no buzzer.
- Hint button labelled "Show me" with a lightbulb.
- End screen: one supportive sentence (from DDA `messageKey`), a big "Play again" and "Back home". No scores, unless the patient's profile has `show_points=true` (then show points only, not accuracy).

## Accessibility per game
- Touch targets ≥ 64px; drag-and-drop always has a tap-tap alternative (tap item, tap target).
- No time limits below level 4; time limits are generous and never shown as a countdown — a gentle progress arc instead.
- All images have `alt` from content pack `title_translations`.

## Phase 10 pack metadata

- `routine_scene.tags.variants` is a non-empty list of `{imageUrl, differences}`. Each difference is `{id, title, imageUrl}`; a variant has 1–4 unique difference IDs. The base image and variant must depict the same scene. Original generated demo scenes include variants with 1–4 objects removed.
- `festival.tags` supplies translated `season`, `month`, and `state` labels. Festival Match uses season at L1–3, month at L4–6, and state at L7–10, falling back to season when the selected field has fewer than two distinct labels. Demo celebrations are explicitly fictional practice content.
- `sound` items need both an audio asset and a matching image. Audio is played sequentially at L6+; replay increments hints and cancels prior playback.
- `word` titles come from the requested language pack; Word Pairs uses 3–8 pairs, then a short blank recall delay. Family photos are patient-scoped and are never supplied by public packs.
- Missing required content shows the existing supportive unavailable message.

Favourites use patient-scoped offline metadata and the `patient_profile_favourites` sync allowlist. The server validates game keys and memory ownership and applies timestamp ordering. Home prefers an assigned exercise due today, then a favourite with no engagement in three days, then evening calm time. Walkthrough acknowledgements are stored in patient-scoped `meta.walkthroughSeen`; the section header can replay them.
