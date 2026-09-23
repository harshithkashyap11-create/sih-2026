import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { apiClient } from "../../api/client";
import { loadContentPack } from "../../content/packs";
import { listGames } from "../../db/repo/games";
import { GamePlayer } from "../../games/engine/GamePlayer";
import { gameByKey } from "../../games/registry";
import { createSeededRng } from "../../games/engine/types";
import type { GameModule } from "../../games/engine/types";
export function PracticePage() {
  const { patientId = "", gameKey } = useParams();
  const query = useQuery({
    queryKey: ["practice", patientId],
    queryFn: async () => {
      const [games, patient, family] = await Promise.all([
        listGames(),
        apiClient<{ region: string; language: string }>(
          `/api/v1/patients/${patientId}/`,
          { method: "GET" },
        ),
        apiClient<
          Array<{
            id: string;
            name: string;
            relationship: string;
            photo_url?: string;
          }>
        >(`/api/v1/patients/${patientId}/family/`, { method: "GET" }),
      ]);
      const content = await loadContentPack(patient.region, patient.language);
      return {
        games,
        content: {
          ...content,
          family: family.map((m) => ({
            id: m.id,
            title: m.name,
            relationship: m.relationship,
            imageUrl: m.photo_url ?? "",
          })),
        },
      };
    },
  });
  if (query.isPending) return <p>Loading practice games…</p>;
  if (query.isError) return <p>We could not load practice games.</p>;
  if (!query.data.games.length) return <p>No practice games yet.</p>;
  if (!gameKey)
    return (
      <section>
        <h1>Try a game (practice)</h1>
        <p>Practice does not affect patient progress.</p>
        <ul>
          {query.data.games.filter((g) => gameByKey(g.key)).map((g) => (
            <li key={g.key}>
              <Link
                className="block min-h-[44px] p-3"
                to={`/caregiver/${patientId}/practice/${g.key}`}
              >
                {g.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  const game = query.data.games.find((g) => g.key === gameKey);
  const module = gameByKey(gameKey);
  if (!game || !module) return <><p>This game is unavailable.</p><Link to={`/caregiver/${patientId}/practice`}>Back to practice games</Link></>;
  try {
    module.buildRound(
      game.min_level,
      createSeededRng("availability"),
      query.data.content,
    );
  } catch {
    return <p>This game needs more content before practice.</p>;
  }
  return (
    <GamePlayer
      key={`${patientId}:${gameKey}`}
      module={module as unknown as GameModule<unknown>}
      game={game}
      patientId={patientId}
      content={query.data.content}
      challengeMode={false}
      guestMode
      homePath={`/caregiver/${patientId}/today`}
    />
  );
}
