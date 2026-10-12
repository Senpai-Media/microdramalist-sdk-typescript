// The client against spec/openapi.yaml, the API's one definition (a copy of
// https://microdramalist.com/openapi.yaml, refreshed by `task spec:sync`):
//   - every operation has a client method named by its operationId (one
//     deliberate exception, below);
//   - each method calls the spec's method and path, and sends only query
//     parameters the spec declares;
//   - each method returns the spec's own 200 example unchanged.
// A spec change that adds an endpoint or a parameter fails here first.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { MicroDramaList } from "../src/index.js";
import { fakeFetch } from "./helpers.js";

type Op = {
  operationId: string;
  parameters?: { $ref?: string; name?: string; in?: string }[];
  responses: Record<string, { content?: Record<string, { example?: unknown }> }>;
};
const spec = parse(readFileSync(new URL("../spec/openapi.yaml", import.meta.url), "utf8"), {
  maxAliasCount: -1,
});

// requestPlatform needs the site's browser sign-in cookie, not a token, so
// an SDK cannot call it on a user's behalf (src/client.ts header).
const NOT_IN_SDK = new Set(["requestPlatform"]);

// How each operation is called in these tests, with the spec's own example values.
const CALLS: Record<string, (c: MicroDramaList) => Promise<unknown>> = {
  getDrama: (c) => c.getDrama("mdid-r229ssxt"),
  searchDramas: (c) => c.searchDramas("billionaire"),
  requestShow: (c) => c.requestShow("https://www.reelshort.com/movie/example-123"),
  newDramasFeed: (c) => c.newDramasFeed({ genre: "Revenge", platform: "dramabox", language: "eng" }),
  getStatsPlatforms: (c) => c.getStatsPlatforms(),
  getStatsGenres: (c) => c.getStatsGenres({ platform: "dramabox", language: "eng", tags: "platform" }),
  getStatsTimeline: (c) =>
    c.getStatsTimeline({ genre: "Revenge", platform: "dramabox", language: "eng", tags: "all", interval: "week" }),
  listDramas: (c) => c.listDramas({ genre: "Revenge", platform: "dramabox", language: "eng", sort: "popular", page: 2 }),
  listNewDramas: (c) => c.listNewDramas({ genre: "Revenge", platform: "dramabox", language: "eng", days: 7, page: 1 }),
  listChanges: (c) => c.listChanges({ since: "2026-10-10T00:00:00Z" }),
  getDramaWatch: (c) => c.getDramaWatch("mdid-r229ssxt"),
  getDramaMatches: (c) => c.getDramaMatches("mdid-r229ssxt"),
  getDramaChart: (c) => c.getDramaChart("mdid-r229ssxt"),
  listChartWeeks: (c) => c.listChartWeeks(),
  getChartWeek: (c) => c.getChartWeek("latest"),
};

const ops: { method: string; path: string; op: Op }[] = [];
for (const [path, item] of Object.entries(spec.paths as Record<string, Record<string, Op>>)) {
  for (const [method, op] of Object.entries(item)) ops.push({ method: method.toUpperCase(), path, op });
}

/** A parameter, following a components $ref. */
function param(p: { $ref?: string; name?: string; in?: string }) {
  return p.$ref ? spec.components.parameters[p.$ref.split("/").pop()!] : p;
}

describe("spec coverage", () => {
  it("has a method for every operation", () => {
    const client = new MicroDramaList({ token: "mdl_test" }) as unknown as Record<string, unknown>;
    for (const { op } of ops) {
      if (NOT_IN_SDK.has(op.operationId)) continue;
      expect(typeof client[op.operationId], op.operationId).toBe("function");
      expect(CALLS[op.operationId], `test call for ${op.operationId}`).toBeDefined();
    }
  });
});

describe.each(ops.filter(({ op }) => !NOT_IN_SDK.has(op.operationId)))("$op.operationId", ({ method, path, op }) => {
  const ok = op.responses["200"];
  const [mediaType, media] = Object.entries(ok.content ?? {})[0] ?? [];
  const example = media?.example;

  it("calls the spec's method and path with declared parameters only", async () => {
    const { fetch, calls } = fakeFetch(
      mediaType === "application/json" ? { body: example } : { text: String(example) },
    );
    await CALLS[op.operationId](new MicroDramaList({ token: "mdl_test", fetch }));
    const call = calls[0];
    expect(call.method).toBe(method);
    const pattern = new RegExp("^" + path.replace(/\{[^}]+\}/g, "[^/]+") + "$");
    expect(call.url.pathname).toMatch(pattern);
    const declared = new Set((op.parameters ?? []).map(param).filter((p) => p.in === "query").map((p) => p.name));
    for (const name of call.url.searchParams.keys()) expect(declared, `query ${name}`).toContain(name);
  });

  it("returns the spec's 200 example", async () => {
    const { fetch } = fakeFetch(mediaType === "application/json" ? { body: example } : { text: String(example) });
    const got = await CALLS[op.operationId](new MicroDramaList({ token: "mdl_test", fetch }));
    expect(got).toEqual(example);
  });
});
