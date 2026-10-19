# Getting started: your API token and first calls

This guide takes you from nothing to a working script in about five
minutes. The free endpoints (drama lookup, search, show requests and the
RSS feed) need none of it; everything else needs a personal API token.

## 1. Create an account and verify your email

1. Go to [microdramalist.com/signup](https://microdramalist.com/signup) and
   create an account (or [log in](https://microdramalist.com/login)).
2. Open the verification email we send and click its link. Tokens can only
   be created by a verified account; until then Settings says *"Verify your
   email address to create a token."* Lost the email?
   [Send it again](https://microdramalist.com/resend-verification).

## 2. Create a token

1. Open [Settings > API tokens](https://microdramalist.com/settings#api-tokens).
2. Type a name that says what the token is for, e.g. `my-genre-tracker`,
   and click **Create token**.
3. **Copy the token now.** It starts with `mdl_` and is shown once: we keep
   only a hash of it, so nobody (us included) can show it to you again. If
   you lose it, regenerate it (below).

An account can have up to five live tokens. Use one per app or script, so
you can turn one off without breaking the others.

## 3. Keep your token secret

A token is a password for your account's API quota. Treat it like one:

- **Keep it out of your code.** Put it in an environment variable; the SDK
  reads `MICRODRAMALIST_TOKEN` by itself:

  ```sh
  export MICRODRAMALIST_TOKEN=mdl_...      # macOS / Linux
  setx MICRODRAMALIST_TOKEN mdl_...        # Windows (new terminals)
  ```

  or a `.env` file that your `.gitignore` lists, loaded with
  `node --env-file=.env` (Node 20.6+) or your framework.
- **Never ship it to a browser.** Anything in front-end JavaScript can be
  read by whoever loads the page. Call the data endpoints from your server,
  a build step or a script, and send your pages only the results. The free
  endpoints are fine to call from a browser.
- **Leaked one?** In Settings > API tokens, **Regenerate** gives the token
  a new secret and the old one stops working at once; **Disable** pauses it
  (enable it again later); **Revoke** deletes it for good.

## 4. Install the SDK

```sh
npm install github:Senpai-Media/microdramalist-sdk-typescript
```

Node 18 or newer, Bun, Deno or any runtime with `fetch`.

## 5. Your first calls

Save this as `first.mjs`:

```js
import { MicroDramaList } from "microdramalist";

const mdl = new MicroDramaList(); // reads MICRODRAMALIST_TOKEN

// Free: no token used.
const [hit] = await mdl.searchDramas("billionaire");
console.log("Found:", hit.title, hit.id);

// Token: the apps we track, largest first.
const { platforms, attribution } = await mdl.getStatsPlatforms();
for (const p of platforms.slice(0, 5)) {
  console.log(`${p.name}: ${p.titles} titles, ${p.englishShare}% in English`);
}

// The top genres on one app.
const { genres } = await mdl.getStatsGenres({ platform: platforms[0].platform });
console.log(genres.slice(0, 5).map((g) => `${g.genre} ${g.share}%`).join(", "));

console.log(attribution); // credit this wherever you show the data
console.log("Requests left today:", mdl.lastRateLimit?.dailyRemaining);
```

Run it:

```sh
node first.mjs
```

If you see `AuthenticationError: this endpoint needs an API token`, the
environment variable is not set in that terminal; if you see `unknown or
revoked API token`, the value is wrong or the token was revoked.

## 6. Limits

| | Free endpoints | Data endpoints (token) |
| --- | --- | --- |
| Per minute | 30 per IP address | 60 per token |
| Per hour | 150 per IP address | 300 per token |
| Per day | 1,000 per IP address (UTC day; then a `429` until 00:00 UTC that names the free token) | none |
| Show requests | 20 an hour per address | |

Over a limit the API answers `429` with `Retry-After`. The SDK waits and
retries per-minute limits for you, and throws `RateLimitError` for the
daily one. Need the whole catalogue? Download the free monthly data packs
from [microdramalist.com/data](https://microdramalist.com/data) instead of
paging through `listDramas`, then keep them current with `iterChanges`.

## 7. Credit

The data is CC BY 4.0. Show the credit line (every data response has it as
`attribution`) with a link to https://microdramalist.com next to your
chart, table or article.

## Next

- [README](../README.md#every-method): every method.
- [examples/](../examples): runnable scripts.
- [API reference](https://microdramalist.com/api-docs): every endpoint,
  parameter and field.
