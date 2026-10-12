// The errors the client throws. Every non-2xx answer becomes a
// MicroDramaListError carrying the HTTP status and the API's own `error`
// message (the API always answers `{"error": "..."}` in English, except the
// RSS feed, whose errors are plain text); the common statuses get a
// subclass so callers can `instanceof` them instead of comparing numbers.

import type { RateLimit } from "./types.js";

/** Any error answer from the API, or a network failure (status 0). */
export class MicroDramaListError extends Error {
  /** The HTTP status; 0 when the request never got an answer. */
  readonly status: number;
  /** The rate-limit headers of the failed response, when it had them. */
  readonly rateLimit: RateLimit | null;

  constructor(message: string, status: number, rateLimit: RateLimit | null = null) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.rateLimit = rateLimit;
  }
}

/** 400: a parameter was refused; the message names it and what it accepts. */
export class BadRequestError extends MicroDramaListError {}

/**
 * 401: no token, a malformed one, an unknown or revoked one, or one its
 * owner disabled in Settings > API tokens. Also thrown before any request
 * when a token endpoint is called on a client without a token.
 */
export class AuthenticationError extends MicroDramaListError {}

/** 404: no published drama with this id, or no chart for this week. */
export class NotFoundError extends MicroDramaListError {}

/**
 * 429: over the per-minute or per-day limit. `retryAfter` is the seconds
 * the server asked us to wait (until UTC midnight for the daily limit).
 */
export class RateLimitError extends MicroDramaListError {
  readonly retryAfter: number | null;

  constructor(message: string, retryAfter: number | null, rateLimit: RateLimit | null) {
    super(message, 429, rateLimit);
    this.retryAfter = retryAfter;
  }
}
