// One genre's share of each app's catalogue: which apps lean into Revenge?
//
//   MICRODRAMALIST_TOKEN=mdl_... node examples/genre-share.mjs [genre]
//
// Uses 1 + (number of apps) requests: the platform list, then each app's genres.

import { MicroDramaList } from "microdramalist";

const genre = process.argv[2] ?? "Revenge";
const mdl = new MicroDramaList();

const { platforms, attribution } = await mdl.getStatsPlatforms();
const rows = [];
for (const p of platforms.filter((p) => p.enabled && p.stories >= 100)) {
  const { genres } = await mdl.getStatsGenres({ platform: p.platform });
  const g = genres.find((x) => x.genre === genre);
  rows.push({ app: p.name, stories: p.stories, [genre]: g?.stories ?? 0, share: g?.share ?? 0 });
}
rows.sort((a, b) => b.share - a.share);
console.table(rows);
console.log(attribution);
