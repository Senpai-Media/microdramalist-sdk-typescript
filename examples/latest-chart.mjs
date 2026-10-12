// This week's MicroDramaList Top 20, with movement and where to watch #1.
//
//   MICRODRAMALIST_TOKEN=mdl_... node examples/latest-chart.mjs

import { MicroDramaList } from "microdramalist";

const mdl = new MicroDramaList();
const chart = await mdl.getChartWeek("latest");

const arrow = { up: "▲", down: "▼", same: "=", new: "NEW", reentry: "RE" };
console.log(`MicroDramaList Top 20, week ${chart.week} (from ${chart.startsOn})\n`);
for (const e of chart.entries) {
  const last = e.lastWeek === null ? "  " : String(e.lastWeek).padStart(2);
  console.log(`${String(e.rank).padStart(2)}  ${arrow[e.move].padEnd(3)} last ${last}  ${e.title}`);
}

const top = chart.entries[0];
if (top) {
  const { watch } = await mdl.getDramaWatch(top.id);
  console.log(`\nWatch #1 on: ${[...new Set(watch.map((w) => w.platformName))].join(", ")}`);
}
console.log(`\n${chart.attribution}`);
