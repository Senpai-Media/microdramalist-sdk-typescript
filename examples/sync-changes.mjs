// Keep a local copy in sync: every drama created, updated or pulled since a
// time (default: 24 hours ago). Pair it with a data pack from
// https://microdramalist.com/data for the starting point.
//
//   MICRODRAMALIST_TOKEN=mdl_... node examples/sync-changes.mjs [since]

import { MicroDramaList } from "microdramalist";

const mdl = new MicroDramaList();
const since = process.argv[2] ?? new Date(Date.now() - 24 * 3600 * 1000).toISOString();

const counts = { created: 0, updated: 0, pulled: 0 };
let last = since;
for await (const event of mdl.iterChanges({ since })) {
  counts[event.type]++;
  last = event.at;
  // Here: fetch event.url's drama with mdl.getDrama(event.id) and upsert it,
  // or drop the listing on `pulled`.
}
console.log(counts);
console.log(`Next run: node examples/sync-changes.mjs ${last}`);
