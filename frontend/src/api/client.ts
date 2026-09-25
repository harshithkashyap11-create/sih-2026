export type ErrorType<Error> = Error;
export type BodyType<BodyData> = BodyData;

import { demoApiResponse } from "../demo/demoApi";

type RefreshAccessToken = () => Promise<string | null>;

export type ApiClientOptions = RequestInit & {
  skipAuthRefresh?: boolean;
  responseType?: "blob";
  timeoutMs?: number;
};

let accessToken: string | null = null;
let refreshAccessToken: RefreshAccessToken | null = null;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request returned ${status}`);
    this.name = "ApiError";
  }
}

export function setApiAccessToken(token: string | null): void {
  accessToken = token;
}

export function setApiRefreshHandler(handler: RefreshAccessToken | null): void {
  refreshAccessToken = handler;
}

async function parseResponse(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return undefined;
  }

  const contentType = response.headers.get("content-type");
  return contentType?.includes("application/json")
    ? response.json()
    : response.text();
}

async function request<T>(
  url: string,
  options: ApiClientOptions,
  canRefresh: boolean,
): Promise<T> {
  const fetchOptions = { ...options };
  delete fetchOptions.skipAuthRefresh;
  delete fetchOptions.responseType;
  delete fetchOptions.timeoutMs;
  const headers = new Headers(fetchOptions.headers);
  headers.set("Accept", "application/json");
  if (typeof fetchOptions.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const response =
    demoApiResponse(url, fetchOptions, headers) ??
    (await fetch(url, { ...fetchOptions, headers }));

  if (response.status === 401 && canRefresh && refreshAccessToken) {
    const refreshedToken = await refreshAccessToken();
    if (refreshedToken) {
      accessToken = refreshedToken;
      return request<T>(url, options, false);
    }
  }

  const body =
    response.ok && options.responseType === "blob"
      ? await response.blob()
      : await parseResponse(response);
  if (!response.ok) {
    throw new ApiError(response.status, body);
  }

  return body as T;
}

export async function apiClient<T>(
  url: string,
  options: ApiClientOptions,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) abort();
  const timeout = setTimeout(
    abort,
    options.timeoutMs ?? (options.responseType === "blob" ? 60_000 : 15_000),
  );
  try {
    return await request<T>(
      url,
      { ...options, signal: controller.signal },
      options.skipAuthRefresh !== true,
    );
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}
