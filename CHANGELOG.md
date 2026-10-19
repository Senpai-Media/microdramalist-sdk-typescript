# Changelog

## 0.1.0 (unreleased)

- 2026-10-19: the API's limits changed. A token is 60 a minute and 300 an
  hour with no daily limit; the free endpoints 30 a minute, 150 an hour
  and 1,000 a day per address. `lastRateLimit` gains `hourlyLimit`,
  `hourlyRemaining` and `hourlyReset`; `dailyLimit` and `dailyRemaining`
  are set only on the free endpoints' daily refusal. The vendored spec
  carries the API's terms of use.

- First release: every MicroDramaList API v1 endpoint (free and data),
  typed from the OpenAPI 3.1 spec; typed errors; rate-limit headers;
  automatic retry of per-minute 429s; `iterDramas`, `iterNewDramas` and
  `iterChanges`.
