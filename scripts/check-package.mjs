// The npm package's contents, checked before every publish (npm run
// pack:check, and prepublishOnly): exactly the built SDK, its docs, README,
// CHANGELOG, LICENSE and package.json -- nothing else -- and no file in it
// carrying a credential-shaped string or an encrypted-secrets marker.
// Fails (exit 1) and lists what is wrong.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const ALLOWED = [
  /^package\.json$/,
  /^README\.md$/,
  /^CHANGELOG\.md$/,
  /^LICENSE$/,
  /^docs\/[a-z0-9-]+\.md$/,
  /^dist\/(client|errors|index|types)\.(js|d\.ts)$/,
];
// Things that must never ship: tokens (ours are mdl_, GitHub's ghp_/github_pat_,
// npm's npm_, PyPI's pypi-), private keys, and sops/age encrypted files.
const FORBIDDEN = [
  /mdl_[A-Za-z0-9_-]{20,}/,
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /npm_[A-Za-z0-9]{30,}/,
  /pypi-[A-Za-z0-9_-]{30,}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /ENC\[AES256_GCM/,
  /age1[a-z0-9]{50,}/,
  /\bsops:/,
];

const [{ files }] = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { encoding: "utf8" }));
const problems = [];
for (const { path } of files) {
  if (!ALLOWED.some((re) => re.test(path))) problems.push(`not allowed in the package: ${path}`);
  const text = readFileSync(path, "utf8");
  for (const re of FORBIDDEN) if (re.test(text)) problems.push(`${path} matches ${re}`);
}
if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`package ok: ${files.length} files\n  ${files.map((f) => f.path).join("\n  ")}`);
