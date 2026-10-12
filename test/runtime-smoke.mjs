// A dependency-free check that the built package loads and works on the
// oldest Node it supports (package.json engines: >=18). vitest needs Node
// 22+, so CI runs this file on Node 18 and 20 instead of the test suite:
//   npm run build && node test/runtime-smoke.mjs
// Offline: a fake fetch answers.

import assert from "node:assert/strict";
import { MicroDramaList, AuthenticationError, RateLimitError } from "../dist/index.js";

const seen = [];
const fake = async (url, init) => {
  seen.push({ url: String(url), auth: init.headers.Authorization });
  if (String(url).includes("/charts/")) {
    return new Response(JSON.stringify({ error: "rate limit exceeded (per day)" }), {
      status: 429,
      headers: { "Retry-After": "40000" },
    });
  }
  return new Response(JSON.stringify([{ id: "mdid-x", title: "X", posterUrl: null, description: null }]), {
    headers: { "X-RateLimit-Limit": "30", "X-RateLimit-Remaining": "29" },
  });
};

const free = new MicroDramaList({ token: "", fetch: fake });
const hits = await free.searchDramas("x");
assert.equal(hits[0].id, "mdid-x");
assert.equal(free.lastRateLimit.remaining, 29);
assert.equal(seen[0].auth, undefined);
await assert.rejects(free.getStatsPlatforms(), AuthenticationError);

const paid = new MicroDramaList({ token: "mdl_t", fetch: fake });
await assert.rejects(paid.listChartWeeks(), RateLimitError);
assert.equal(seen.at(-1).auth, "Bearer mdl_t");

console.log(`runtime smoke ok on Node ${process.version}`);
