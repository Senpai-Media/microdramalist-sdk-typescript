# MicroDramaList SDK for TypeScript and JavaScript

The official client for the [MicroDramaList API](https://microdramalist.com/api-docs):
look up and search micro dramas, count the catalogue by genre, platform and
language, follow a genre over time, list what is new or what changed, see
where a show streams, and read the weekly MicroDramaList Top 20.

- Typed responses for every endpoint, written from the API's
  [OpenAPI 3.1 spec](https://microdramalist.com/openapi.yaml).
- No dependencies: built on `fetch`, so it runs in Node 18+, Bun, Deno,
  Cloudflare Workers and the browser (free endpoints only in the browser;
  see [Keep your token secret](docs/getting-started.md#keep-your-token-secret)).
- Handles the details: the bearer token, typed errors, rate-limit headers,
  waiting out a `429`, and iterators over paged results.

> **Status (October 2026):** the free endpoints are live; the token
> endpoints (stats, lists, changes, charts) are rolling out on
> microdramalist.com and answer 404 until they arrive. Not yet on npm:
> install from GitHub (below).

Also available: [the Python SDK](https://github.com/Senpai-Media/microdramalist-sdk-python).

## Install

```sh
npm install github:Senpai-Media/microdramalist-sdk-typescript
```

## Quick start

The free endpoints need no account:

```ts
import { MicroDramaList } from "microdramalist";

const mdl = new MicroDramaList();

const results = await mdl.searchDramas("billionaire");
const drama = await mdl.getDrama(results[0].id);
console.log(drama.title, drama.genres, drama.availableOn.map((l) => l.platform));
```

The data endpoints need a free personal token. **[Getting started](docs/getting-started.md)
walks through creating one.** Then:

```ts
// Reads MICRODRAMALIST_TOKEN from the environment, or pass { token: "mdl_..." }.
const mdl = new MicroDramaList();

const { platforms } = await mdl.getStatsPlatforms();
const { genres, totalStories } = await mdl.getStatsGenres({ platform: "dramabox" });
const chart = await mdl.getChartWeek("latest");

for (const entry of chart.entries) {
  console.log(`#${entry.rank} ${entry.title} (${entry.move})`);
}
```

## Every method

| Method | Endpoint | Token |
| --- | --- | --- |
| `getDrama(id)` | `GET /api/v1/dramas/{id}`: one drama, every live listing | no |
| `searchDramas(q)` | `GET /api/v1/search`: up to 20 title matches, or an `mdid-` lookup | no |
| `requestShow(url)` | `POST /api/v1/show-requests`: ask us to add a show by its app URL | no |
| `newDramasFeed({ platform, genre, language })` | `GET /feeds/new.xml`: new dramas as RSS (a string) | no |
| `getStatsPlatforms()` | `GET /api/v1/stats/platforms`: every app with its size | yes |
| `getStatsGenres({ platform, language, tags })` | `GET /api/v1/stats/genres`: stories per genre tag | yes |
| `getStatsTimeline({ genre, platform, language, tags, interval })` | `GET /api/v1/stats/timeline`: a genre or app over time | yes |
| `listDramas({ genre, platform, language, sort, page })` | `GET /api/v1/dramas`: 50 a page | yes |
| `listNewDramas({ genre, platform, language, days, page })` | `GET /api/v1/new`: first seen in the last days | yes |
| `listChanges({ since })` | `GET /api/v1/changes`: created, updated and pulled since a time | yes |
| `getDramaWatch(id)` | `GET /api/v1/dramas/{id}/watch`: where to watch it | yes |
| `getDramaMatches(id)` | `GET /api/v1/dramas/{id}/matches`: one show across apps | yes |
| `getDramaChart(id)` | `GET /api/v1/dramas/{id}/chart`: its Top 20 history | yes |
| `listChartWeeks()` | `GET /api/v1/charts/weekly`: every charted week | yes |
| `getChartWeek(week = "latest")` | `GET /api/v1/charts/weekly/{week}`: one week's Top 20 | yes |

And three iterators that do the paging for you:

```ts
for await (const drama of mdl.iterDramas({ genre: "Revenge", platform: "reelshort" })) { /* ... */ }
for await (const drama of mdl.iterNewDramas({ days: 3 })) { /* ... */ }
for await (const event of mdl.iterChanges({ since: "2026-10-10" })) { /* ... */ }
```

Words the API uses: a **title** is one drama page (one language or dub
version) and a **story** is the show behind its versions. **Platform tags**
are the genre tags an app gives a show itself; `tags: "all"` adds the ones
MicroDramaList assigned. **firstSeen** is when our crawler first saw a
title, not a release date. Full reference: [microdramalist.com/api-docs](https://microdramalist.com/api-docs).

## Errors and rate limits

Every error is a `MicroDramaListError` with `status` and the API's own
message; the common ones have their own class:

```ts
import { AuthenticationError, BadRequestError, NotFoundError, RateLimitError } from "microdramalist";

try {
  await mdl.getStatsGenres({ platform: "not-an-app" });
} catch (err) {
  if (err instanceof BadRequestError) console.error(err.message); // "platform: a platform slug, ..."
  else throw err;
}
```

| Class | Status | When |
| --- | --- | --- |
| `BadRequestError` | 400 | A parameter was refused; the message says which and what it accepts. |
| `AuthenticationError` | 401 | No token, or an unknown, revoked or disabled one. |
| `NotFoundError` | 404 | No such drama, or no chart for that week. |
| `RateLimitError` | 429 | Over a limit; `retryAfter` is the seconds to wait. |

A token allows **60 requests a minute and 10,000 a day** (UTC). The client
waits out a per-minute `429` and retries (twice by default; set
`maxRetries` and `maxRetryWait`), but throws at once on the daily limit,
whose `Retry-After` runs to midnight. `mdl.lastRateLimit` holds the last
answer's limits:

```ts
await mdl.getStatsPlatforms();
console.log(mdl.lastRateLimit); // { limit: 60, remaining: 59, reset: 1791..., dailyLimit: 10000, dailyRemaining: 9999 }
```

## Options

```ts
new MicroDramaList({
  token: "mdl_...", // default: process.env.MICRODRAMALIST_TOKEN
  baseUrl: "https://microdramalist.com", // the default
  fetch: customFetch, // default: the global fetch
  maxRetries: 2, // 429 retries; 0 turns them off
  maxRetryWait: 60, // seconds; a longer Retry-After throws instead
});
```

## Data license and credit

The data is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/):
use it for anything, commercial included, and credit MicroDramaList with a
link. Every data response carries the credit line in `attribution`:

> Data from MicroDramaList (https://microdramalist.com)

For the whole catalogue at once, download the monthly data packs from
[microdramalist.com/data](https://microdramalist.com/data) and keep them
current with `iterChanges`.

## Examples

[`examples/`](examples) has runnable scripts: a genre's share on each app,
the latest chart, and syncing changes. Run one with
`npm run build && MICRODRAMALIST_TOKEN=mdl_... node examples/genre-share.mjs`.

## Development

```sh
npm install
npm test            # offline: a fake fetch, and every example from the spec
npm run typecheck
npm run build
```

`spec/openapi.yaml` is a copy of the API's spec; the tests check every
method against it. Refresh it with
`curl -fsSL https://microdramalist.com/openapi.yaml -o spec/openapi.yaml`
and run the tests.

Changing the SDK itself: `ROUTING.md` names what to open for each kind of
change, and `CONTEXT.md` maps the repository.

## License

The SDK is [MIT](LICENSE). The data it fetches is CC BY 4.0 (above).
