# microdramalist-sdk-typescript

The public TypeScript/JavaScript SDK for the MicroDramaList API
(https://microdramalist.com/api-docs). **This repository is public**
(github.com/Senpai-Media/microdramalist-sdk-typescript): everything
committed here, comments included, is read by strangers. Nothing internal
goes in it -- no infrastructure, hostnames other than microdramalist.com,
other repositories' paths, credentials, or notes about how the site is run.

- `spec/openapi.yaml` is a copy of the API's published spec
  (https://microdramalist.com/openapi.yaml); `task spec:sync` refreshes
  it. It is the source of truth: `src/types.ts` and `src/client.ts` follow
  it by hand, and `test/spec.test.ts` fails when an operation, path or query
  parameter has no match in the client, or a spec example does not come
  back unchanged.
- One client method per operationId. `requestPlatform` is deliberately
  absent (it needs the site's browser session cookie, not a token).
- No runtime dependencies: `fetch` only. The package supports Node 18+;
  the test suite needs Node 22+ (vitest), so `test/runtime-smoke.mjs`
  covers 18 and 20.
- The npm package holds only the built SDK and its docs (the owner,
  2026-10-12): package.json `files` is the allowlist, and
  scripts/check-package.mjs (`task package:check`, and prepublishOnly)
  fails on any other file or any credential-shaped string.
- Every change: `task check` passes, README / docs / CHANGELOG describe it
  in the same commit, and the Python SDK
  (github.com/Senpai-Media/microdramalist-sdk-python) gets the same change.
- Commit messages: `area: lowercase imperative description` (at most 80
  characters), a blank line, then a body for anything non-trivial. No AI
  attribution.
