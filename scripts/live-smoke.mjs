// Calls the live API through the built package: the free endpoints always,
// and every data endpoint when MICRODRAMALIST_TOKEN is set. A quick "does
// the SDK still match production" check before a release (task smoke:live).
// About 12 requests; well inside every limit.

import { MicroDramaList } from "microdramalist";

const mdl = new MicroDramaList({ baseUrl: process.env.MICRODRAMALIST_BASE_URL });
const step = async (name, fn) => {
  try {
    const out = await fn();
    console.log(`ok    ${name}: ${out}`);
  } catch (err) {
    console.log(`FAIL  ${name}: ${err.name} ${err.status ?? ""} ${err.message}`);
    process.exitCode = 1;
  }
};

let id;
await step("searchDramas", async () => {
  const r = await mdl.searchDramas("billionaire");
  id = r[0]?.id;
  return `${r.length} results`;
});
await step("getDrama", async () => (await mdl.getDrama(id)).title);
await step("newDramasFeed", async () => `${(await mdl.newDramasFeed()).length} bytes of RSS`);

if (!mdl.hasToken) {
  console.log("skip  data endpoints: set MICRODRAMALIST_TOKEN to check them");
} else {
  let platform;
  await step("getStatsPlatforms", async () => {
    const r = await mdl.getStatsPlatforms();
    platform = r.platforms[0]?.platform;
    return `${r.platforms.length} platforms`;
  });
  await step("getStatsGenres", async () => `${(await mdl.getStatsGenres({ platform })).genres.length} genres`);
  await step("getStatsTimeline", async () => `${(await mdl.getStatsTimeline({ platform })).firstSeen.length} periods`);
  await step("listDramas", async () => `${(await mdl.listDramas({ platform })).dramas.length} dramas`);
  await step("listNewDramas", async () => `${(await mdl.listNewDramas()).dramas.length} new`);
  await step("listChanges", async () => `${(await mdl.listChanges()).events.length} events`);
  await step("getDramaWatch", async () => `${(await mdl.getDramaWatch(id)).watch.length} listings`);
  await step("getDramaMatches", async () => `${(await mdl.getDramaMatches(id)).versions.length} versions`);
  await step("getDramaChart", async () => `${(await mdl.getDramaChart(id)).weeksOnChart} weeks on chart`);
  await step("listChartWeeks", async () => `${(await mdl.listChartWeeks()).weeks.length} weeks`);
  await step("getChartWeek", async () => `${(await mdl.getChartWeek()).entries.length} entries`);
  console.log("rate limit after:", mdl.lastRateLimit);
}
