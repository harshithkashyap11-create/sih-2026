import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  listGames,
  getDifficulty,
  type GameDefinitionDto,
} from "../../../db/repo/games";
import { DexiePatientRepository } from "../../../db/repo/patient";
import { memoriesRepository } from "../../../db/repo/memories";
import { catalogByKey } from "../../../games/registry";
import {
  createIntegratedTransport,
  recoverIntegratedCheckpoint,
} from "../../../games/engine/integratedTransport";
import { createSeededRng } from "../../../games/engine/types";
import { useTts } from "../../../shared/hooks/useTts";
import { currentPatient } from "./GamesPage";
import { PrivateImage } from "../../../shared/ui/PrivateImage";
import { GameSafetyContext } from "../../../games/integrated/shared/GameSafetyContext";
import "../../../games/integrated/shared/games.css";
import "../../../games/integrated/shared/games7to12.css";
import "../../../games/integrated/shared/host.css";

export function IntegratedGamePage({ gameKey }: { gameKey: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const speak = useTts();
  const [data, setData] = useState<{
    patientId: string;
    game: GameDefinitionDto;
    level: number;
    maxDifficulty: number;
    sessionCapMinutes: number;
    useMemoriesInQuiz: boolean;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const entry = catalogByKey(gameKey);
  const guestMode =
    new URLSearchParams(window.location.search).get("practice") === "true";
  useEffect(() => {
    let active = true;
    void Promise.all([currentPatient(), listGames()])
      .then(async ([patient, items]) => {
        const game = items.find((item) => item.key === gameKey);
        if (!game || !entry?.component) throw new Error("Unavailable game");
        await recoverIntegratedCheckpoint(patient.id, game);
        const state = await getDifficulty(patient.id, game);
        const requested = Number(
          new URLSearchParams(window.location.search).get("level"),
        );
        const level = Math.max(
          1,
          Math.min(
            5,
            game.max_level,
            patient.maxDifficultyLevel ?? 5,
            state.capLevel ?? 5,
            !state.lockedByDoctor && requested && Number.isFinite(requested)
              ? Math.round(requested)
              : state.level,
          ),
        );
        if (active)
          setData({
            patientId: patient.id,
            game,
            level,
            maxDifficulty: Math.min(5, game.max_level, state.capLevel ?? 5, patient.maxDifficultyLevel ?? 5),
            sessionCapMinutes: patient.sessionCapMinutes,
            useMemoriesInQuiz: patient.useMemoriesInQuiz ?? false,
          });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [gameKey, entry]);
  const transport = useMemo(
    () =>
      data
        ? createIntegratedTransport(data.patientId, data.game, guestMode, {
            sessionCapMinutes: data.sessionCapMinutes,
            onFatigue: () => setSessionEnded(true),
          })
        : null,
    [data, guestMode],
  );
  const rng = useMemo(() => {
    const source = createSeededRng((data?.patientId ?? "") + gameKey);
    return () => source.next();
  }, [data?.patientId, gameKey]);
  const provider = useMemo(
    () => ({
      getItems: async () => {
        if (!data?.useMemoriesInQuiz) return [];
        const family = await new DexiePatientRepository().getFamilyMembers();
        const people = family
          .filter((member) => member.photoUrl)
          .map((member) => ({
            id: member.id,
            type: "person",
            displayName: member.name,
            relationship: member.relationship,
            imageUrl: member.photoUrl!,
            location: "",
            note: "",
          }));
        const memories = (await memoriesRepository.list()).filter(
          (memory) =>
            memory.patientId === data?.patientId &&
            memory.visibility === "quiz",
        );
        return [
          ...people,
          ...memories.flatMap((memory) => {
            const photo = memory.media.find(
              (media) => media.kind === "photo" || media.kind === "image",
            )?.url;
            if (!photo) return [];
            return [
              {
                id: memory.id,
                type: "place",
                displayName: memory.place || memory.title,
                imageUrl: photo,
                location: memory.place,
                note: memory.summary,
              },
            ];
          }),
        ];
      },
    }),
    [data?.patientId, data?.useMemoriesInQuiz],
  );
  useEffect(
    () => () => {
      if (transport) void transport.exit().catch(() => undefined);
    },
    [transport],
  );
  useEffect(() => {
    if (!data || !transport) return;
    const timer = window.setTimeout(() => {
      setSessionEnded(true);
      void transport.exit("session_cap").catch(() => undefined);
    }, data.sessionCapMinutes * 60_000);
    return () => window.clearTimeout(timer);
  }, [data, transport]);
  if (failed || !entry?.component)
    return <p role="status">{t("games.unavailable")}</p>;
  if (!data || !transport) return <p role="status">{t("games.loading")}</p>;
  if (sessionEnded) return <section><p>{t("confused.comfort")}</p><button type="button" onClick={() => void navigate("/patient/games")}>{t("games.common.backToGames")}</button></section>;
  const Component = entry.component;
  return (
    <section className="integrated-game">
      {i18n.resolvedLanguage === "en" && gameKey !== "personal_memory" && (
        <p role="status">{t("games.demoContent")}</p>
      )}
      {guestMode && <p role="status">{t("games.practiceBanner")}</p>}
      {gameKey === "personal_memory" && <p>{t("games.personalNotice")}</p>}
      <GameSafetyContext.Provider value={{ maxDifficulty: data.maxDifficulty }}>
      <Component
        difficulty={data.level}
        initialDifficulty={data.level}
        seed={data.patientId + gameKey}
        rng={rng}
        speak={speak}
        ddaClient={transport}
        submitMetrics={transport.submitMetrics}
        dataProvider={provider}
        ImageComponent={PrivateImage}
        onExit={(metrics) => {
          void (metrics ? transport.submitSession(metrics) : transport.exit())
            .catch(() => undefined)
            .finally(() => navigate("/patient/games"));
        }}
        onSessionEnd={(metrics) => {
          void transport.submitSession(metrics).catch(() => undefined);
        }}
        onComplete={(metrics) => {
          void transport.submitSession(metrics).catch(() => undefined);
        }}
      />
      </GameSafetyContext.Provider>
    </section>
  );
}
