# microdramalist-sdk-typescript: the TypeScript/JavaScript SDK for the MicroDramaList API

<!-- A map of the repository for contributors: what each folder is for,
     what a change depends on, and the rules every change keeps. Short on
     purpose; the long form is README.md and docs/getting-started.md. -->

## Goal

A dependency-free, typed client for every endpoint of the
[MicroDramaList API](https://microdramalist.com/api-docs), for anyone who
wants micro drama data in Node, Bun, Deno, Cloudflare Workers or a
browser. It works when every operation in `spec/openapi.yaml` has a
method, every spec example parses through it unchanged, and `task check`
passes on every supported Node.

## Inside

| Path                                   | What it is                                                                                                                                                                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/`                                 | the package: `client.ts` (the `MicroDramaList` class, one method per operationId, the iterators, `#request` with the retry rule), `errors.ts` (the error classes), `types.ts` (the API's shapes, by hand from the spec), `index.ts` (the exports) |
| `spec/`                                | `openapi.yaml`: a copy of the API's published spec, the source of truth; `task spec:sync` refreshes it                                                                                                                                            |
| `test/`                                | `spec.test.ts` (every method against the spec), `client.test.ts` (token, requests, errors, rate limits, iterators), `helpers.ts` (the fake fetch), `runtime-smoke.mjs` (the built package on Node 18 and 20)                                      |
| `examples/`                            | runnable scripts: a genre's share on each app, the latest chart, syncing changes                                                                                                                                                                  |
| `scripts/`                             | `check-package.mjs` (the npm package holds only the SDK and its docs, no credential-shaped string), `live-smoke.mjs` (the live API, `task smoke:live`)                                                                                            |
| `docs/`                                | `getting-started.md`: creating a token, keeping it secret, first calls, limits, credit                                                                                                                                                            |
| `.github/`                             | `workflows/test.yml`: typecheck, tests and the runtime smoke on every push and pull request                                                                                                                                                       |
| `package.json`                         | the package name `microdramalist`, `files` (the publish allowlist), `engines` (Node 18+), the npm scripts the tasks call                                                                                                                          |
| `tsconfig.json`, `tsconfig.build.json` | type-checking everything; building `src/` to `dist`                                                                                                                                                                                               |
| `Taskfile.yml`                         | `install`, `build`, `test`, `typecheck`, `check`, `package:check`, `smoke:live`, `spec:sync`                                                                                                                                                      |
| `README.md`, `CHANGELOG.md`, `LICENSE` | the user guide (every method, errors, options, license), the release notes, MIT                                                                                                                                                                   |
| `CLAUDE.md`                            | the rules for an AI session (`AGENTS.md` is a symlink to it); `ROUTING.md`: what to load for each kind of change                                                                                                                                  |
| `mise.toml`                            | tool versions (`mise trust && mise install`)                                                                                                                                                                                                      |

## Depends on / depended on by

- Reads: the MicroDramaList API at https://microdramalist.com and its
  spec; the platform's `fetch`. Development only: TypeScript, vitest and
  `yaml` (the spec test).
- Used by: anyone installing from GitHub (npm later); the
  [Python SDK](https://github.com/Senpai-Media/microdramalist-sdk-python)
  mirrors every change here, method for method.

## Load / skip

- Load: for a method, the operation in `spec/openapi.yaml`, `src/client.ts`, `src/types.ts` and `test/spec.test.ts`; for a user-facing change, `README.md` and `docs/getting-started.md`.
- Skip: `dist` and `node_modules` (generated, gitignored); `package-lock.json` unless a dependency changes; `spec/openapi.yaml` in full (read the one operation).

## Rules and traps

- This repository is public: nothing internal goes in it, comments included (`CLAUDE.md`).
- The spec is the source of truth: `src/types.ts` and `src/client.ts` follow it by hand, and `test/spec.test.ts` fails on any operation, path or query parameter without a match (`CLAUDE.md`).
- One method per operationId; `requestPlatform` is deliberately absent (it needs the site's browser session, not a token).
- No runtime dependencies and Node 18+; vitest needs Node 22+, so `test/runtime-smoke.mjs` covers 18 and 20 (`.github/workflows/test.yml`).
- The npm package holds only `dist`, `docs/`, README, CHANGELOG and LICENSE: `scripts/check-package.mjs` fails on anything else (`task package:check`, and `prepublishOnly`).
- Every change: `task check` passes; README, docs and CHANGELOG describe it in the same commit; the Python SDK gets the same change.
- Commit messages: `area: lowercase imperative description`, at most 80 characters, then a body for anything non-trivial (`CLAUDE.md`).
- Never commit a token: `.env*` is ignored and the tests run offline on a fake fetch (`test/helpers.ts`).

## Read next

- `README.md` ("Development", "Every method"), then `docs/getting-started.md`.
- `CLAUDE.md`: the rules in full; `CHANGELOG.md`: what each release changed.
- The Python SDK, for the same change on the other side.
