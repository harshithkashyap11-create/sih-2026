import { offlineQuestion } from "../quiz";
import { apiClient } from "../../api/client";
import {
  activeProfile,
  db,
  getMeta,
  type CachedMemory,
  type CachedQuizAttempt,
} from "../schema";
import { createOutboxEntry } from "../outbox";
import { isFakeOffline } from "../outbox";

interface PatientList {
  results: Array<{ id: string }>;
}
export interface QuizQuestion {
  memory_id: string | null;
  question_type: string;
  prompt: string;
  options: string[];
  expected_label: string;
  media_url: string | null;
}

async function patientId(): Promise<string> {
  const cached = await activeProfile();
  if (cached) return cached.id;
  const list = await apiClient<PatientList>("/api/v1/patients/", {
    method: "GET",
  });
  if (!list.results[0]) throw new Error("Patient profile is unavailable");
  return list.results[0].id;
}

export const memoriesRepository = {
  async list(): Promise<CachedMemory[]> {
    const id = await patientId();
    if (isFakeOffline() || !navigator.onLine)
      return db.memories.where("patientId").equals(id).toArray();
    try {
      const remote = await apiClient<
        Array<{
          id: string;
          title: string;
          occasion: string;
          occurred_on: string | null;
          place: string;
          summary: string;
          visibility: string;
          people: CachedMemory["people"];
          media: CachedMemory["media"];
        }>
      >(`/api/v1/patients/${id}/memories/`, { method: "GET" });
      const memories = remote.map((item) => ({
        ...item,
        patientId: id,
        occurredOn: item.occurred_on,
      }));
      await db.transaction("rw", db.memories, async () => {
        await db.memories.where("patientId").equals(id).delete();
        await db.memories.bulkPut(memories);
      });
      const { purgeUnreferencedMedia } = await import("../media");
      await purgeUnreferencedMedia(id);
      return memories;
    } catch {
      return db.memories.where("patientId").equals(id).toArray();
    }
  },
  async get(memoryId: string): Promise<CachedMemory | undefined> {
    const cached = await db.memories.get(memoryId);
    if ((isFakeOffline() || !navigator.onLine) && cached?.patientId === (await patientId())) return cached;
    return (await this.list()).find((memory) => memory.id === memoryId);
  },
  async nextQuestion(): Promise<QuizQuestion> {
    const id = await patientId();
    if (!isFakeOffline() && navigator.onLine) {
      try {
        return await apiClient<QuizQuestion>(
          `/api/v1/patients/${id}/memory-quiz/next/`,
          { method: "GET" },
        );
      } catch {
        /* Cached questions remain available. */
      }
    }
    const [memories, family, attempts, settings] = await Promise.all([
      db.memories.where("patientId").equals(id).toArray(),
      db.familyMembers.where("patientId").equals(id).toArray(),
      db.quizAttempts.where("patientId").equals(id).toArray(),
      getMeta("gamePatient"),
    ]);
    return offlineQuestion(
      memories,
      family,
      attempts,
      Boolean(
        settings &&
        (JSON.parse(settings) as { useMemoriesInQuiz?: boolean })
          .useMemoriesInQuiz,
      ),
    );
  },
  async saveAttempt(
    attempt: Omit<CachedQuizAttempt, "patientId">,
  ): Promise<void> {
    const id = await patientId();
    const payload = {
      id: attempt.id,
      patient_id: id,
      memory_id: attempt.memoryId,
      question_type: attempt.questionType,
      expected: attempt.expected,
      given: attempt.given,
      correct: attempt.correct,
      attempted_at: attempt.attemptedAt,
      response_ms: attempt.responseMs,
      device_updated_at: attempt.attemptedAt,
    };
    await db.transaction("rw", db.quizAttempts, db.outbox, async () => {
      await db.quizAttempts.put({ ...attempt, patientId: id });
      await db.outbox.put(
        createOutboxEntry("memory_quiz_attempt", attempt.id, id, payload),
      );
    });
  },
};
