import { db, activeProfile } from "./schema";
import { base64, unbase64, vaultOwner } from "./vault";
import { apiClient } from "../api/client";
import { useAuthStore } from "../features/auth/authStore";

export function mediaIdentity(url: string): string {
  const address = new URL(url, window.location.origin);
  // Remove only temporary authorization parameters; retain object version IDs.
  for (const key of [...address.searchParams.keys()]) {
    if (/^(x-amz-|x-goog-)(algorithm|credential|date|expires|signedheaders|signature|security-token)$/i.test(key) || /^(signature|expires|awsaccesskeyid|token)$/i.test(key)) {
      address.searchParams.delete(key);
    }
  }
  address.hash = "";
  address.searchParams.sort();
  return address.href;
}

async function fetchMedia(url: string): Promise<Blob | undefined> {
  const address = new URL(url, window.location.origin);
  if (
    address.origin === window.location.origin &&
    address.pathname.startsWith("/media/")
  ) {
    return apiClient<Blob>(url, {
      method: "GET",
      cache: "no-store",
      responseType: "blob",
    });
  }
  // A signed object-storage URL must never receive our API bearer token.
  const response = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.status === 401 || response.status === 403) {
    const profile = await activeProfile();
    if (profile) {
      const [family, memories] = await Promise.all([
        apiClient<Array<{ photo_url?: string }>>(`/api/v1/patients/${profile.id}/family/`, { method: "GET" }),
        apiClient<Array<{ media: Array<{ url: string }> }>>(`/api/v1/patients/${profile.id}/memories/`, { method: "GET" }),
      ]);
      const renewed = [...family.map((member) => member.photo_url), ...memories.flatMap((memory) => memory.media.map((media) => media.url))]
        .find((candidate) => candidate && candidate !== url && mediaIdentity(candidate) === mediaIdentity(url));
      if (renewed) {
        const retry = await fetch(renewed, { cache: "no-store", credentials: "same-origin" });
        return retry.ok ? retry.blob() : undefined;
      }
    }
  }
  return response.ok ? response.blob() : undefined;
}
/** Private media bypasses HTTP and service-worker caches and is encrypted in memoryMedia. */
export async function privateMediaUrl(
  url: string,
): Promise<string | undefined> {
  if (
    url.startsWith("/content/") ||
    url.startsWith("data:") ||
    url.startsWith("blob:")
  )
    return url;
  const owner = vaultOwner();
  if (!owner) {
    const session = useAuthStore.getState();
    if (!session.accessToken || !["caregiver", "doctor"].includes(session.role ?? "")) return undefined;
    const content = await fetchMedia(url);
    return content ? URL.createObjectURL(content) : undefined;
  }
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(mediaIdentity(url)),
  );
  const id = `media:${owner}:${base64(digest)}`;
  let row = await db.memoryMedia.get(id);
  if (!row) {
    const legacyId = `media:${owner}:${base64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)))}`;
    const legacy = await db.memoryMedia.get(legacyId);
    if (legacy) {
      row = { ...legacy, id };
      await db.memoryMedia.put(row);
      if (legacyId !== id) await db.memoryMedia.delete(legacyId);
    }
  }
  if (!row && navigator.onLine) {
    const response = await fetchMedia(url);
    if (!response) return undefined;
    const content = base64(await response.arrayBuffer());
    if (owner !== vaultOwner()) return undefined;
    row = {
      id,
      patientId: owner,
      deviceUpdatedAt: new Date().toISOString(),
      content,
      mime: response.type || "application/octet-stream",
    };
    await db.memoryMedia.put(row);
  }
  if (!row || owner !== vaultOwner() || typeof row.content !== "string")
    return undefined;
  return URL.createObjectURL(
    new Blob([unbase64(row.content)], { type: String(row.mime) }),
  );
}

/** Preserve owned legacy cached photos before retiring the plaintext media cache. */
export async function migrateLegacyMedia(): Promise<void> {
  if (typeof caches === "undefined") return;
  const owner = vaultOwner();
  if (!owner) return;
  const legacy = (await caches.has("smarana-media")) ? await caches.open("smarana-media") : null;
  const urls = new Set<string>();
  for (const member of await db.familyMembers.toArray())
    if (member.photoUrl) urls.add(member.photoUrl);
  for (const memory of await db.memories.toArray())
    for (const media of memory.media) if (media.url) urls.add(media.url);
  for (const url of urls) {
    const id = `media:${owner}:${base64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(mediaIdentity(url))))}`;
    const oldId = `media:${owner}:${base64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)))}`;
    const old = await db.memoryMedia.get(oldId);
    if (old && id !== oldId) {
      await db.memoryMedia.put({ ...old, id });
      await db.memoryMedia.delete(oldId);
    }
    const response = await legacy?.match(url);
    if (!response) continue;
    await db.memoryMedia.put({
      id,
      patientId: owner,
      deviceUpdatedAt: new Date().toISOString(),
      content: base64(await response.arrayBuffer()),
      mime: response.headers.get("Content-Type") ?? "application/octet-stream",
    });
  }
  await caches.delete("smarana-media");
}

/** Remove encrypted blobs no longer referenced by this patient's cached metadata. */
export async function purgeUnreferencedMedia(patientId: string): Promise<void> {
  const owner = vaultOwner();
  if (!owner) return;
  const urls = new Set<string>();
  for (const member of await db.familyMembers.where("patientId").equals(patientId).toArray()) if (member.photoUrl) urls.add(member.photoUrl);
  for (const memory of await db.memories.where("patientId").equals(patientId).toArray()) for (const media of memory.media) if (media.url) urls.add(media.url);
  const keep = new Set<string>();
  for (const url of urls) {
    for (const identity of [url, mediaIdentity(url)]) keep.add(`media:${owner}:${base64(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(identity)))}`);
  }
  const rows = await db.memoryMedia.where("patientId").equals(owner).toArray();
  if (vaultOwner() !== owner) return;
  await db.memoryMedia.bulkDelete(rows.filter((row) => row.id.startsWith(`media:${owner}:`) && !keep.has(row.id)).map((row) => row.id));
}
