# Routing: what to load for each kind of change

Find the row for the change, open what it names, skip what it says to
skip. The spec is the source of truth and the tests enforce it, so most
rows start there.

| Task                                    | Go to                        | Load                                                                                                                            | Skip                                         |
| --------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Add or change an API method             | `src/client.ts`              | the operation in `spec/openapi.yaml`, `src/types.ts`, `test/spec.test.ts`, `README.md` ("Every method")                         | `examples/` unless the method is shown there |
| The spec changed upstream               | `spec/openapi.yaml`          | `task spec:sync`, then what `test/spec.test.ts` reports; `src/types.ts` for a changed shape                                     | `src/errors.ts`                              |
| Errors, retries, rate limits            | `src/errors.ts`              | `src/client.ts` (`#request`), `test/client.test.ts` ("errors", "rate limits"), `README.md` ("Errors and rate limits")           | the method list                              |
| Iterators and paging                    | `src/client.ts`              | `iterDramas`, `iterNewDramas`, `iterChanges`; `test/client.test.ts` ("iterators")                                               | `src/types.ts` unless a page shape changed   |
| Client options, the token, the base URL | `src/client.ts`              | `ClientOptions`, `test/client.test.ts` ("token"), `README.md` ("Options"), `docs/getting-started.md` ("Keep your token secret") | `spec/openapi.yaml`                          |
| User documentation                      | `README.md`                  | `docs/getting-started.md`, `CHANGELOG.md`; the Python SDK's README for the same wording                                         | the source unless a claim needs checking     |
| An example                              | `examples/`                  | the sibling example, `README.md` ("Examples"); `node --check` it (`task check` does)                                            | the tests                                    |
| A release                               | `package.json`               | `CHANGELOG.md`, `scripts/check-package.mjs` (`task package:check`), `scripts/live-smoke.mjs` (`task smoke:live`)                | the tests' internals                         |
| Supported Node versions, CI             | `.github/workflows/test.yml` | `test/runtime-smoke.mjs`, `package.json` ("engines"), `mise.toml`                                                               | the source                                   |
| Build and type-check settings           | `tsconfig.build.json`        | `tsconfig.json`, `package.json` ("exports", "files")                                                                            | the tests                                    |

## Always

- `CONTEXT.md` (the map), then the file the row names.
- `CLAUDE.md`: a public repository, the spec rule, the package allowlist, the commit style, and the Python SDK gets the same change.
- `task check` before a commit; `task package:check` before a publish.

## Never by default

- `dist` and `node_modules` (generated, gitignored); `package-lock.json` unless a dependency changes.
- `spec/openapi.yaml` in full: read the one operation.
