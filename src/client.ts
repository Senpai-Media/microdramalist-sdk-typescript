// The MicroDramaList API client: one method per operation in
// spec/openapi.yaml, named by its operationId, plus async iterators for the
// paged and the since-based endpoints. Built on the platform's own fetch
// (Node 18+, Deno, Bun, browsers), so the package has no runtime
// dependencies.
//
// Two kinds of endpoint (the spec's description):
//   free -- getDrama, searchDramas, requestShow, newDramasFeed: no token,
//           limited per address (30 a minute for reads);
//   data -- everything else: a personal token from
//           https://microdramalist.com/settings#api-tokens, sent as
//           `Authorization: Bearer mdl_...`; 60 a minute and 10,000 a UTC
//           day per token.
// The spec's one other operation, requestPlatform, needs the site's
// browser sign-in cookie rather than a token, so it is left out on
// purpose (test/spec.test.ts lists it as the one exception).

import {
  AuthenticationError,
  BadRequestError,
  MicroDramaListError,
  NotFoundError,
  RateLimitError,
} from "./errors.js";
import type {
  ChangeEvent,
  ChangesParams,
  ChangesResponse,
  ChartWeekResponse,
  ChartWeeksResponse,
  Drama,
  DramaChartResponse,
  DramasResponse,
  FeedParams,
  GenresParams,
  GenresResponse,
  ListDramasParams,
  ListedDrama,
  MatchesResponse,
  NewDramasParams,
  NewDramasResponse,
  PlatformsResponse,
  RateLimit,
  SearchResult,
  ShowRequestReply,
  TimelineParams,
  TimelineResponse,
  WatchResponse,
} from "./types.js";

/** The API's one origin; absolute URLs in responses always use it. */
export const DEFAULT_BASE_URL = "https://microdramalist.com";

/** The environment variable read when no token is passed. */
export const TOKEN_ENV = "MICRODRAMALIST_TOKEN";

export interface ClientOptions {
  /**
   * A personal API token (`mdl_...`). Defaults to the MICRODRAMALIST_TOKEN
   * environment variable where there is one (Node, Bun, Deno with
   * --allow-env). Only the data endpoints need it.
   */
  token?: string;
  /** Defaults to https://microdramalist.com. */
  baseUrl?: string;
  /** A fetch implementation; defaults to the global fetch. */
  fetch?: typeof fetch;
  /**
   * How many times a 429 is retried after waiting its Retry-After
   * (default 2). 0 turns retries off.
   */
  maxRetries?: number;
  /**
   * The longest Retry-After, in seconds, worth waiting for (default 60).
   * A longer one -- the daily limit asks to wait until UTC midnight --
   * throws RateLimitError at once instead of sleeping.
   */
  maxRetryWait?: number;
}

type Query = Record<string, string | number | undefined>;

interface RequestOptions {
  method?: "GET" | "POST";
  query?: Query;
  body?: unknown;
  /** A data endpoint: needs the token. */
  auth?: boolean;
  /** Read the body as text (the RSS feed) instead of JSON. */
  text?: boolean;
}

/** Reads the token from the environment where there is one, never throwing. */
function envToken(): string | undefined {
  try {
    // `process` is absent in browsers; Deno without --allow-env throws.
    const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
    return env?.[TOKEN_ENV] || undefined;
  } catch {
    return undefined;
  }
}

/** A header as an integer, or null when absent or not a number. */
function intHeader(headers: Headers, name: string): number | null {
  const v = headers.get(name);
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function readRateLimit(headers: Headers): RateLimit | null {
  const rl: RateLimit = {
    limit: intHeader(headers, "X-RateLimit-Limit"),
    remaining: intHeader(headers, "X-RateLimit-Remaining"),
    reset: intHeader(headers, "X-RateLimit-Reset"),
    dailyLimit: intHeader(headers, "X-RateLimit-Daily-Limit"),
    dailyRemaining: intHeader(headers, "X-RateLimit-Daily-Remaining"),
  };
  return Object.values(rl).every((v) => v === null) ? null : rl;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MicroDramaList {
  readonly baseUrl: string;
  /**
   * The rate-limit headers of the last answer (successful or not), or null
   * before the first request or when it carried none.
   */
  lastRateLimit: RateLimit | null = null;

  readonly #token: string | undefined;
  readonly #fetch: typeof fetch;
  readonly #maxRetries: number;
  readonly #maxRetryWait: number;

  constructor(options: ClientOptions = {}) {
    this.#token = options.token ?? envToken();
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    // Bound, so a global fetch keeps its `this` (browsers throw "Illegal
    // invocation" on an unbound window.fetch).
    this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
    this.#maxRetries = options.maxRetries ?? 2;
    this.#maxRetryWait = options.maxRetryWait ?? 60;
  }

  /** Whether the client has a token, so the data endpoints can be called. */
  get hasToken(): boolean {
    return Boolean(this.#token);
  }

  // ---------------------------------------------------------------- free

  /** One drama by its public id (`mdid-...`). An id merged into another drama answers that drama. */
  getDrama(id: string): Promise<Drama> {
    return this.#request(`/api/v1/dramas/${encodeURIComponent(id)}`);
  }

  /**
   * Up to 20 published dramas whose title contains `q`, or an exact lookup
   * when `q` is a public id (`mdid-...`).
   */
  searchDramas(q: string): Promise<SearchResult[]> {
    return this.#request("/api/v1/search", { query: { q } });
  }

  /**
   * Ask MicroDramaList to add a show by its page URL on an app it covers.
   * 20 an hour per address.
   */
  requestShow(url: string): Promise<ShowRequestReply> {
    return this.#request("/api/v1/show-requests", { method: "POST", body: { url } });
  }

  /** New dramas of the last 7 days as RSS 2.0 XML (a string). Free. */
  newDramasFeed(params: FeedParams = {}): Promise<string> {
    return this.#request("/feeds/new.xml", { query: { ...params }, text: true });
  }

  // ----------------------------------------------------- catalogue stats

  /** Every app tracked, with its size, largest first. Token. */
  getStatsPlatforms(): Promise<PlatformsResponse> {
    return this.#request("/api/v1/stats/platforms", { auth: true });
  }

  /** Stories per genre tag in a scope, the 200 largest. Token. */
  getStatsGenres(params: GenresParams = {}): Promise<GenresResponse> {
    return this.#request("/api/v1/stats/genres", { auth: true, query: { ...params } });
  }

  /** A genre, or a whole app, over time: snapshots and firstSeen. Token. */
  getStatsTimeline(params: TimelineParams = {}): Promise<TimelineResponse> {
    return this.#request("/api/v1/stats/timeline", { auth: true, query: { ...params } });
  }

  // -------------------------------------------------------------- dramas

  /** One page (50) of published dramas, filtered. Token. */
  listDramas(params: ListDramasParams = {}): Promise<DramasResponse> {
    return this.#request("/api/v1/dramas", { auth: true, query: { ...params } });
  }

  /** Every drama `listDramas` would page through, page by page (up to page 200). Token. */
  async *iterDramas(params: Omit<ListDramasParams, "page"> = {}): AsyncGenerator<ListedDrama> {
    let page: number | null = 1;
    while (page !== null) {
      const res: DramasResponse = await this.listDramas({ ...params, page });
      yield* res.dramas;
      page = res.nextPage;
    }
  }

  /** One page (50) of dramas first seen in the last `days` (default 7). Token. */
  listNewDramas(params: NewDramasParams = {}): Promise<NewDramasResponse> {
    return this.#request("/api/v1/new", { auth: true, query: { ...params } });
  }

  /** Every drama `listNewDramas` would page through. Token. */
  async *iterNewDramas(params: Omit<NewDramasParams, "page"> = {}): AsyncGenerator<ListedDrama> {
    let page: number | null = 1;
    while (page !== null) {
      const res: NewDramasResponse = await this.listNewDramas({ ...params, page });
      yield* res.dramas;
      page = res.nextPage;
    }
  }

  /**
   * Dramas created, updated and pulled since a time (default 24 hours ago,
   * at most 31 days back), oldest first, up to 1,000 a call. Token.
   */
  listChanges(params: ChangesParams = {}): Promise<ChangesResponse> {
    const since = params.since instanceof Date ? params.since.toISOString() : params.since;
    return this.#request("/api/v1/changes", { auth: true, query: { since } });
  }

  /**
   * Every change since a time, following `next` until `complete`. Token.
   *
   * A call starts at its `since` inclusively, so the events at the boundary
   * time come back on the next call too; they are yielded once.
   */
  async *iterChanges(params: ChangesParams = {}): AsyncGenerator<ChangeEvent> {
    let since: string | Date | undefined = params.since;
    let boundary = new Set<string>();
    const key = (e: ChangeEvent) => `${e.type} ${e.id} ${e.platform ?? ""} ${e.at}`;
    for (;;) {
      const res = await this.listChanges({ since });
      const fresh = res.events.filter((e) => !boundary.has(key(e)));
      yield* fresh;
      if (res.complete) return;
      // No progress (a full page all at the boundary time): stop rather
      // than ask for the same page forever.
      if (fresh.length === 0) return;
      boundary = new Set(res.events.filter((e) => e.at === res.next).map(key));
      since = res.next;
    }
  }

  /** Where to watch a drama: every live listing of it and of its versions. Token. */
  getDramaWatch(id: string): Promise<WatchResponse> {
    return this.#request(`/api/v1/dramas/${encodeURIComponent(id)}/watch`, { auth: true });
  }

  /** One show across apps: its versions and each one's listings. Token. */
  getDramaMatches(id: string): Promise<MatchesResponse> {
    return this.#request(`/api/v1/dramas/${encodeURIComponent(id)}/matches`, { auth: true });
  }

  // -------------------------------------------------------------- charts

  /** A drama's history on the weekly Top 20. Token. */
  getDramaChart(id: string): Promise<DramaChartResponse> {
    return this.#request(`/api/v1/dramas/${encodeURIComponent(id)}/chart`, { auth: true });
  }

  /** Every frozen week of the Top 20, newest first. Token. */
  listChartWeeks(): Promise<ChartWeeksResponse> {
    return this.#request("/api/v1/charts/weekly", { auth: true });
  }

  /** One week's Top 20: an ISO week such as `2026-W40`, or `latest` (the default). Token. */
  getChartWeek(week = "latest"): Promise<ChartWeekResponse> {
    return this.#request(`/api/v1/charts/weekly/${encodeURIComponent(week)}`, { auth: true });
  }

  // ------------------------------------------------------------ plumbing

  async #request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    if (opts.auth && !this.#token) {
      throw new AuthenticationError(
        `this endpoint needs an API token: create one at ${DEFAULT_BASE_URL}/settings#api-tokens ` +
          `and pass it as new MicroDramaList({ token }) or set ${TOKEN_ENV}`,
        401,
      );
    }

    const url = new URL(this.baseUrl + path);
    for (const [k, v] of Object.entries(opts.query ?? {})) {
      // Empty means "all" to the API, so it is the same as leaving it out.
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }

    const headers: Record<string, string> = {
      Accept: opts.text ? "application/rss+xml, text/plain" : "application/json",
    };
    if (opts.auth) headers.Authorization = `Bearer ${this.#token}`;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";

    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.#fetch(url, {
          method: opts.method ?? "GET",
          headers,
          body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
        });
      } catch (err) {
        throw new MicroDramaListError(`request to ${url.pathname} failed: ${(err as Error).message}`, 0);
      }

      const rateLimit = readRateLimit(res.headers);
      this.lastRateLimit = rateLimit;

      if (res.ok) {
        return (opts.text ? await res.text() : await res.json()) as T;
      }

      const message = await errorMessage(res);
      if (res.status === 429) {
        const retryAfter = intHeader(res.headers, "Retry-After");
        if (attempt < this.#maxRetries && retryAfter !== null && retryAfter <= this.#maxRetryWait) {
          // Retry-After is whole seconds; a little over, so the window has turned.
          await sleep(retryAfter * 1000 + 250);
          continue;
        }
        throw new RateLimitError(message, retryAfter, rateLimit);
      }
      switch (res.status) {
        case 400:
          throw new BadRequestError(message, 400, rateLimit);
        case 401:
          throw new AuthenticationError(message, 401, rateLimit);
        case 404:
          throw new NotFoundError(message, 404, rateLimit);
        default:
          throw new MicroDramaListError(message, res.status, rateLimit);
      }
    }
  }
}

/** The API's `error` message, or the text body (the feed), or the status line. */
async function errorMessage(res: Response): Promise<string> {
  const text = await res.text().catch(() => "");
  try {
    const body = JSON.parse(text) as { error?: unknown };
    if (typeof body.error === "string") return body.error;
  } catch {
    // Not JSON: the feed answers errors as plain text.
  }
  return text.trim() || `HTTP ${res.status} ${res.statusText}`.trim();
}
