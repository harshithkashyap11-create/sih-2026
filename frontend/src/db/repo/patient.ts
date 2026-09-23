import { apiClient } from "../../api/client";
import { activeProfile, db, getMeta, type CachedFamilyMember } from "../schema";
import { isFakeOffline } from "../outbox";
import { CARE_TIMEZONE, careTime } from "../reminders";

export interface Orientation {
  greeting_key: "morning" | "afternoon" | "evening";
  day: string;
  date: string;
  time: string;
  home_label: string;
  next_activity: { id: string; title: string; scheduled_for: string } | null;
  family_member: {
    id: string;
    name: string;
    relationship: string;
    photo_url: string | null;
  } | null;
}

interface PatientList {
  results: Array<{ id: string; name: string }>;
}

export interface PatientRepository {
  getOrientation(signal?: AbortSignal): Promise<Orientation>;
}

export class DexiePatientRepository implements PatientRepository {
  async getFamilyMembers(signal?: AbortSignal): Promise<CachedFamilyMember[]> {
    signal?.throwIfAborted();
    const cachedProfile = await activeProfile();
    signal?.throwIfAborted();
    const patientId = cachedProfile?.id;
    if (!patientId) return [];
    if (isFakeOffline() || !navigator.onLine)
      return patientId
        ? db.familyMembers.where("patientId").equals(patientId).toArray()
        : [];
    try {
      const remote = await apiClient<
        Array<{
          id: string;
          name: string;
          relationship_label: string;
          relationship: string;
          photo_url: string | null;
          phone: string;
          is_emergency_contact: boolean;
        }>
      >(`/api/v1/patients/${patientId}/family/`, { method: "GET", signal });
      signal?.throwIfAborted();
      const members = remote.map((item) => ({
        id: item.id,
        patientId,
        name: item.name,
        relationship: item.relationship_label || item.relationship,
        photoUrl: item.photo_url,
        phone: item.phone,
        isEmergencyContact: item.is_emergency_contact,
      }));
      await db.transaction("rw", db.familyMembers, async () => {
        await db.familyMembers.where("patientId").equals(patientId).delete();
        await db.familyMembers.bulkPut(members);
      });
      const { purgeUnreferencedMedia } = await import("../media");
      await purgeUnreferencedMedia(patientId);
      return members.sort(
        (a, b) =>
          Number(Boolean(b.isEmergencyContact)) -
          Number(Boolean(a.isEmergencyContact)),
      );
    } catch {
      signal?.throwIfAborted();
      return db.familyMembers.where("patientId").equals(patientId).toArray();
    }
  }

  async getOrientation(signal?: AbortSignal): Promise<Orientation> {
    signal?.throwIfAborted();
    const cached = await activeProfile();
    signal?.throwIfAborted();
    const online =
      !isFakeOffline() &&
      (typeof navigator === "undefined" || navigator.onLine);
    if (online) {
      try {
        const patients = await apiClient<PatientList>("/api/v1/patients/", {
          method: "GET",
          signal,
          timeoutMs: 3_000,
        });
        const patient = patients.results[0];
        signal?.throwIfAborted();
        if (!patient) throw new Error("Patient profile is unavailable");
        const orientation = await apiClient<Orientation>(
          `/api/v1/patients/${patient.id}/orientation/`,
          { method: "GET", signal, timeoutMs: 3_000 },
        );
        signal?.throwIfAborted();
        await db.transaction(
          "rw",
          db.profile,
          db.familyMembers,
          db.meta,
          async () => {
            await db.profile.put({
              ...(await db.profile.get(patient.id)),
              id: patient.id,
              name: patient.name,
              userId: await getMeta("patientUserId"),
              orientation,
              refreshedAt: new Date().toISOString(),
            });
            const member = orientation.family_member;
            if (member) {
              const cachedMember: CachedFamilyMember = {
                id: member.id,
                patientId: patient.id,
                name: member.name,
                relationship: member.relationship,
                photoUrl: member.photo_url,
              };
              const existing = await db.familyMembers.get(member.id);
              await db.familyMembers.put({ ...existing, ...cachedMember });
            }
          },
        );
        return orientation;
      } catch (error) {
        signal?.throwIfAborted();
        if (!cached) throw error;
      }
    }
    if (cached) {
      const orientation = cached.orientation as Orientation;
      const now = new Date();
      const reminders = await db.reminders
        .where("patientId")
        .equals(cached.id)
        .toArray();
      const next = reminders
        .filter(
          (item) =>
            (item.status === "pending" || item.status === "later") &&
            Date.parse(item.snoozed_until ?? item.scheduled_at) >=
              now.getTime(),
        )
        .sort(
          (a, b) =>
            Date.parse(a.snoozed_until ?? a.scheduled_at) -
            Date.parse(b.snoozed_until ?? b.scheduled_at),
        )[0];
      return {
        ...orientation,
        greeting_key:
          Number(careTime(now).slice(0, 2)) < 12
            ? "morning"
            : Number(careTime(now).slice(0, 2)) < 17
              ? "afternoon"
              : "evening",
        day: now.toLocaleDateString(undefined, { timeZone: CARE_TIMEZONE, weekday: "long" }),
        date: now.toLocaleDateString(undefined, {
          timeZone: CARE_TIMEZONE,
          month: "long",
          day: "numeric",
          year: "numeric",
        }),
        time: now.toLocaleTimeString(undefined, {
          timeZone: CARE_TIMEZONE,
          hour: "numeric",
          minute: "2-digit",
        }),
        next_activity: next
          ? {
              id: next.id,
              title: next.title,
              scheduled_for: next.snoozed_until ?? next.scheduled_at,
            }
          : null,
      };
    }
    throw new Error("Orientation is unavailable");
  }
}

export const patientRepository = new DexiePatientRepository();
