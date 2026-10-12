// The client's behaviour around the calls: the token, errors, rate limits,
// retries and the iterators. Offline, through the fake fetch.

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  BadRequestError,
  MicroDramaList,
  MicroDramaListError,
  NotFoundError,
  RateLimitError,
} from "../src/index.js";
import { fakeFetch } from "./helpers.js";

const license = {
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  attribution: "Data from MicroDramaList (https://microdramalist.com)",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("token", () => {
  it("sends the bearer token on data endpoints", async () => {
    const { fetch, calls } = fakeFetch({ body: { platforms: [], ...license } });
    await new MicroDramaList({ token: "mdl_abc", fetch }).getStatsPlatforms();
    expect(calls[0].headers.Authorization).toBe("Bearer mdl_abc");
  });

  it("never sends the token to free endpoints", async () => {
    const { fetch, calls } = fakeFetch({ body: [] });
    await new MicroDramaList({ token: "mdl_abc", fetch }).searchDramas("ceo");
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  it("reads MICRODRAMALIST_TOKEN when none is passed", async () => {
    vi.stubEnv("MICRODRAMALIST_TOKEN", "mdl_env");
    const { fetch, calls } = fakeFetch({ body: { weeks: [], ...license } });
    const client = new MicroDramaList({ fetch });
    expect(client.hasToken).toBe(true);
    await client.listChartWeeks();
    expect(calls[0].headers.Authorization).toBe("Bearer mdl_env");
  });

  it("throws before any request when a data endpoint has no token", async () => {
    vi.stubEnv("MICRODRAMALIST_TOKEN", "");
    const { fetch, calls } = fakeFetch({});
    const client = new MicroDramaList({ fetch });
    await expect(client.getStatsPlatforms()).rejects.toThrow(AuthenticationError);
    await expect(client.getStatsPlatforms()).rejects.toThrow(/settings#api-tokens/);
    expect(calls).toHaveLength(0);
  });

  it("calls free endpoints without a token", async () => {
    vi.stubEnv("MICRODRAMALIST_TOKEN", "");
    const { fetch, calls } = fakeFetch({ body: [] });
    await new MicroDramaList({ fetch }).searchDramas("ceo");
    expect(calls).toHaveLength(1);
  });
});

describe("requests", () => {
  it("leaves out empty and undefined parameters (empty means all)", async () => {
    const { fetch, calls } = fakeFetch({ body: { page: 1, perPage: 50, dramas: [], nextPage: null, ...license } });
    await new MicroDramaList({ token: "t", fetch }).listDramas({ genre: "", platform: undefined, language: "eng" });
    expect([...calls[0].url.searchParams.entries()]).toEqual([["language", "eng"]]);
  });

  it("encodes path segments", async () => {
    const { fetch, calls } = fakeFetch({ body: {} });
    await new MicroDramaList({ fetch }).getDrama("mdid-a/b?c");
    expect(calls[0].url.pathname).toBe("/api/v1/dramas/mdid-a%2Fb%3Fc");
  });

  it("sends a Date as an ISO time", async () => {
    const { fetch, calls } = fakeFetch({ body: { since: "", events: [], next: "", complete: true, ...license } });
    await new MicroDramaList({ token: "t", fetch }).listChanges({ since: new Date("2026-10-10T00:00:00Z") });
    expect(calls[0].url.searchParams.get("since")).toBe("2026-10-10T00:00:00.000Z");
  });

  it("posts a show request as JSON", async () => {
    const { fetch, calls } = fakeFetch({ body: { matched: true, alreadyAdded: false } });
    await new MicroDramaList({ fetch }).requestShow("https://www.reelshort.com/movie/x-1");
    expect(calls[0].method).toBe("POST");
    expect(calls[0].headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0].body!)).toEqual({ url: "https://www.reelshort.com/movie/x-1" });
  });

  it("uses a custom base URL without a trailing slash", async () => {
    const { fetch, calls } = fakeFetch({ body: [] });
    await new MicroDramaList({ baseUrl: "http://localhost:3000/", fetch }).searchDramas("x");
    expect(calls[0].url.href).toBe("http://localhost:3000/api/v1/search?q=x");
  });
});

describe("errors", () => {
  it.each([
    [400, BadRequestError, "platform: a platform slug, as /api/v1/stats/platforms lists"],
    [401, AuthenticationError, "unknown or revoked API token"],
    [404, NotFoundError, "not found"],
    [500, MicroDramaListError, "internal error"],
  ])("maps %i to %s with the API's message", async (status, cls, error) => {
    const { fetch } = fakeFetch({ status, body: { error } });
    const err = await new MicroDramaList({ token: "t", fetch }).getStatsGenres().catch((e) => e);
    expect(err).toBeInstanceOf(cls);
    expect(err.status).toBe(status);
    expect(err.message).toBe(error);
  });

  it("reads the feed's plain-text errors", async () => {
    const { fetch } = fakeFetch({ status: 400, text: "platform: a platform slug, as /api/v1/stats/platforms lists" });
    await expect(new MicroDramaList({ fetch }).newDramasFeed({ platform: "!" })).rejects.toThrow(/platform slug/);
  });

  it("wraps a network failure as status 0", async () => {
    const fetch = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof globalThis.fetch;
    const err = await new MicroDramaList({ fetch }).searchDramas("x").catch((e) => e);
    expect(err).toBeInstanceOf(MicroDramaListError);
    expect(err.status).toBe(0);
  });
});

describe("rate limits", () => {
  const headers = {
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": "59",
    "X-RateLimit-Reset": "1791000000",
    "X-RateLimit-Daily-Limit": "10000",
    "X-RateLimit-Daily-Remaining": "9999",
  };

  it("exposes the last answer's headers", async () => {
    const { fetch } = fakeFetch({ body: { weeks: [], ...license }, headers });
    const client = new MicroDramaList({ token: "t", fetch });
    expect(client.lastRateLimit).toBeNull();
    await client.listChartWeeks();
    expect(client.lastRateLimit).toEqual({
      limit: 60,
      remaining: 59,
      reset: 1791000000,
      dailyLimit: 10000,
      dailyRemaining: 9999,
    });
  });

  it("waits Retry-After and retries a 429", async () => {
    vi.useFakeTimers();
    const { fetch, calls } = fakeFetch(
      { status: 429, body: { error: "rate limit exceeded (per minute)" }, headers: { "Retry-After": "2" } },
      { body: { weeks: [], ...license } },
    );
    const p = new MicroDramaList({ token: "t", fetch }).listChartWeeks();
    await vi.advanceTimersByTimeAsync(2500);
    await expect(p).resolves.toMatchObject({ weeks: [] });
    expect(calls).toHaveLength(2);
  });

  it("throws at once when Retry-After is longer than maxRetryWait (the daily limit)", async () => {
    const { fetch, calls } = fakeFetch({
      status: 429,
      body: { error: "rate limit exceeded (per day)" },
      headers: { "Retry-After": "40000", "X-RateLimit-Daily-Remaining": "0" },
    });
    const err = await new MicroDramaList({ token: "t", fetch }).listChartWeeks().catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitError);
    expect(err.retryAfter).toBe(40000);
    expect(err.rateLimit.dailyRemaining).toBe(0);
    expect(calls).toHaveLength(1);
  });

  it("gives up after maxRetries", async () => {
    vi.useFakeTimers();
    const { fetch, calls } = fakeFetch({ status: 429, body: { error: "x" }, headers: { "Retry-After": "1" } });
    const p = new MicroDramaList({ token: "t", fetch, maxRetries: 1 }).listChartWeeks().catch((e) => e);
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBeInstanceOf(RateLimitError);
    expect(calls).toHaveLength(2);
  });
});

describe("iterators", () => {
  const drama = (id: string) => ({ id, slug: id, url: "", title: id, language: null, genres: [], episodeCount: null, releaseYear: null, platforms: [], firstSeen: "" });

  it("iterDramas follows nextPage until null", async () => {
    const { fetch, calls } = fakeFetch(
      { body: { page: 1, perPage: 50, dramas: [drama("a"), drama("b")], nextPage: 2, ...license } },
      { body: { page: 2, perPage: 50, dramas: [drama("c")], nextPage: null, ...license } },
    );
    const ids: string[] = [];
    for await (const d of new MicroDramaList({ token: "t", fetch }).iterDramas({ genre: "Revenge" })) ids.push(d.id);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(calls.map((c) => c.url.searchParams.get("page"))).toEqual(["1", "2"]);
    expect(calls[1].url.searchParams.get("genre")).toBe("Revenge");
  });

  it("iterChanges follows next until complete, yielding boundary events once", async () => {
    const ev = (id: string, at: string) => ({ type: "updated", id, url: "", platform: null, at });
    const { fetch, calls } = fakeFetch(
      { body: { since: "T0", events: [ev("a", "T1"), ev("b", "T2")], next: "T2", complete: false, ...license } },
      { body: { since: "T2", events: [ev("b", "T2"), ev("c", "T3")], next: "T3", complete: true, ...license } },
    );
    const ids: string[] = [];
    for await (const e of new MicroDramaList({ token: "t", fetch }).iterChanges({ since: "T0" })) ids.push(e.id);
    expect(ids).toEqual(["a", "b", "c"]);
    expect(calls.map((c) => c.url.searchParams.get("since"))).toEqual(["T0", "T2"]);
  });

  it("iterChanges stops when a page makes no progress", async () => {
    const ev = { type: "updated", id: "a", url: "", platform: null, at: "T1" };
    const { fetch, calls } = fakeFetch({ body: { since: "T1", events: [ev], next: "T1", complete: false, ...license } });
    const out = [];
    for await (const e of new MicroDramaList({ token: "t", fetch }).iterChanges({ since: "T1" })) out.push(e);
    expect(out).toHaveLength(1);
    expect(calls).toHaveLength(2);
  });
});
