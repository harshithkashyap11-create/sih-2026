import { DDA_ADJUSTMENT, isValidAdjustment } from './gameTypes.js';

/**
 * Transport layer between a game round and the Django DDA endpoint.
 *
 * The client owns *all* network concerns. Games only ever see:
 *   submitRound(metrics) -> { adjustment: -1 | 0 | 1, source, reason }
 *
 * No model logic lives here. When no endpoint is configured, or the request
 * fails, the client returns "keep difficulty" and stores the payload so a
 * future sync layer can replay it. It never throws at the caller.
 */

const KEEP = DDA_ADJUSTMENT.KEEP;

/** In-memory pending store. Survives navigation inside the SPA, not reloads. */
export function createMemoryQueue() {
  let items = [];
  return {
    push(item) {
      items.push(item);
      return item;
    },
    all() {
      return [...items];
    },
    replace(next) {
      items = [...next];
    },
    clear() {
      items = [];
    },
    get size() {
      return items.length;
    },
  };
}

/**
 * Optional persistent store. Pass `queue: createLocalStorageQueue('smarana.dda')`
 * when you want pending results to survive a reload.
 */
export function createLocalStorageQueue(storageKey, storage) {
  const store = storage
    ?? (typeof window !== 'undefined' ? window.localStorage : null);
  if (!store) return createMemoryQueue();

  const read = () => {
    try {
      return JSON.parse(store.getItem(storageKey) || '[]');
    } catch {
      return [];
    }
  };
  const write = (items) => {
    try {
      store.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* quota or private mode: degrade to no persistence */
    }
  };

  return {
    push(item) {
      const items = read();
      items.push(item);
      write(items);
      return item;
    },
    all: read,
    replace: write,
    clear() {
      write([]);
    },
    get size() {
      return read().length;
    },
  };
}

/** Accepts the response shapes a DRF view is likely to return. */
export function parseAdjustment(payload) {
  if (payload == null) return null;
  const candidate = typeof payload === 'number'
    ? payload
    : payload.adjustment
      ?? payload.difficulty_adjustment
      ?? payload.prediction
      ?? payload.result;
  const numeric = Number(candidate);
  return isValidAdjustment(numeric) ? numeric : null;
}

export class DDAClient {
  /**
   * @param {Object} options
   * @param {string|null} options.roundEndpoint    e.g. '/api/dda/round/'
   * @param {string|null} options.sessionEndpoint  e.g. '/api/dda/session/'
   * @param {Function} [options.fetchImpl]
   * @param {Function} [options.getHeaders]  async () => ({ Authorization: ... })
   * @param {number} [options.timeoutMs]
   * @param {Object} [options.queue]
   */
  constructor(options = {}) {
    this.roundEndpoint = options.roundEndpoint ?? `/api/dda/round/`;
    this.sessionEndpoint = options.sessionEndpoint ?? `/api/dda/session/`;
    this.fetchImpl = options.fetchImpl
      ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    this.getHeaders = options.getHeaders ?? (() => ({}));
    this.timeoutMs = options.timeoutMs ?? 4000;
    this.queue = options.queue ?? createMemoryQueue();
  }

  get pendingCount() {
    return this.queue.size;
  }

  get isConfigured() {
    return Boolean(this.roundEndpoint && this.fetchImpl);
  }

  /**
   * Submit one completed round and ask for the next difficulty adjustment.
   * Always resolves. Never rejects.
   */
  async submitRound(metrics) {
    if (!this.isConfigured) {
      this.queue.push({ kind: 'round', metrics, queuedAt: Date.now() });
      return { adjustment: KEEP, source: 'fallback', reason: 'not_configured' };
    }

    try {
      const payload = await this.#post(this.roundEndpoint, metrics);
      const adjustment = parseAdjustment(payload);
      try {
      if (adjustment === null) {
        return { adjustment: KEEP, source: 'fallback', reason: 'unreadable_response' };
      }
      return { adjustment, source: 'server' };
    } catch (error) {
      this.queue.push({ kind: 'round', metrics, queuedAt: Date.now() });
      return {
        adjustment: KEEP,
        source: 'fallback',
        reason: error?.name === 'AbortError' ? 'timeout' : 'network_error',
      };
    }
  }

  /** Fire-and-forget end-of-session record. Does not affect difficulty. */
  async submitSession(metrics) {
    const endpoint = this.sessionEndpoint ?? this.roundEndpoint;
    if (!endpoint || !this.fetchImpl) {
      this.queue.push({ kind: 'session', metrics, queuedAt: Date.now() });
      return { ok: false, reason: 'not_configured' };
    }
    try {
      await this.#post(endpoint, metrics);
      return { ok: true };
    } catch {
      this.queue.push({ kind: 'session', metrics, queuedAt: Date.now() });
      return { ok: false, reason: 'network_error' };
    }
  }

  /** Replay anything captured while the backend was unreachable. */
  async flushQueue() {
    if (!this.isConfigured) return { flushed: 0, remaining: this.queue.size };
    const pending = this.queue.all();
    const stillPending = [];
    let flushed = 0;

    for (const item of pending) {
      const endpoint = item.kind === 'session'
        ? (this.sessionEndpoint ?? this.roundEndpoint)
        : this.roundEndpoint;
      try {
        await this.#post(endpoint, item.metrics);
        flushed += 1;
      } catch {
        stillPending.push(item);
      }
    }

    this.queue.replace(stillPending);
    return { flushed, remaining: stillPending.length };
  }

  async #post(endpoint, body) {
    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;
    const timer = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : null;

    try {
      const headers = await this.getHeaders();
      const response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      if (!response.ok) {
        throw new Error(`DDA request failed with status ${response.status}`);
      }
      return await response.json();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/* --------------------------------------------------------------------------
 * App-wide singleton. Configure once during app bootstrap; games read it lazily
 * so they stay decoupled from auth and routing concerns.
 * ----------------------------------------------------------------------- */

let sharedClient = new DDAClient();

export function configureDDAClient(options) {
  sharedClient = new DDAClient(options);
  return sharedClient;
}

export function getDDAClient() {
  return sharedClient;
}

export default DDAClient;
