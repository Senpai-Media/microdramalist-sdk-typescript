// The MicroDramaList API's request and response shapes, written by hand
// from spec/openapi.yaml (OpenAPI 3.1, the API's one definition). Field
// order and comments follow the spec; a nullable field there
// (`type: [T, "null"]`) is `T | null` here. test/spec.test.ts checks that
// every operation in the spec has a client method and that every spec
// example parses through it, so a spec change that breaks these shapes
// fails the tests after `task spec:sync`.

/** The CC BY 4.0 block every data (token) response ends with. */
export interface License {
  license: "CC BY 4.0";
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/";
  /** The credit line to show beside anything made from the data. */
  attribution: "Data from MicroDramaList (https://microdramalist.com)";
}

/** `platform` = the apps' own genre tags (default); `all` adds ours. */
export type TagSource = "platform" | "all";

/** An ISO week such as `2026-W40`. */
export type IsoWeek = string;

/** A chart entry's movement against the week before. */
export type ChartMove = "up" | "down" | "same" | "new" | "reentry";

// ------------------------------------------------------------------ free

/** One live listing of a drama, as GET /api/v1/dramas/{id} returns it. */
export interface DramaListing {
  /** The app's display name. */
  platform: string;
  /** The link a reader follows (the app's homepage for an unverified listing). */
  url: string;
  unverified: boolean;
  language: string | null;
  dubbed: boolean;
  additionalAttributes: string[];
  externalId: string | null;
  lastCheckedAt: string;
}

/** GET /api/v1/dramas/{id} (free). */
export interface Drama {
  id: string;
  title: string;
  alternativeTitles: string[];
  genres: string[];
  episodeCount: number | null;
  releaseYear: number | null;
  /** The live listings' languages. */
  languages: string[];
  upvotes: number;
  downvotes: number;
  /** Our rewritten description; null until written. */
  description: string | null;
  /** Through our image proxy. */
  posterUrl: string | null;
  availableOn: DramaListing[];
}

/** One match of GET /api/v1/search (free). */
export interface SearchResult {
  id: string;
  title: string;
  posterUrl: string | null;
  description: string | null;
}

/** POST /api/v1/show-requests (free). */
export interface ShowRequestReply {
  /** The URL is on an app we cover. */
  matched: boolean;
  /** Present when matched: the show is already in the catalogue. */
  alreadyAdded?: boolean;
  /** Present when already added and published: /drama/{dramaSlug}. */
  dramaSlug?: string;
}

// ------------------------------------------------------- catalogue stats

export interface PlatformStat {
  /** The slug the other endpoints take as `platform`. */
  platform: string;
  name: string;
  /** Still crawled. */
  enabled: boolean;
  titles: number;
  stories: number;
  /** Percent of titles in English, one decimal. */
  englishShare: number;
  episodeMedian: number | null;
}

/** GET /api/v1/stats/platforms. */
export interface PlatformsResponse extends License {
  platforms: PlatformStat[];
}

export interface GenreStat {
  genre: string;
  stories: number;
  titles: number;
  /** Percent of the scope's stories, one decimal. */
  share: number;
}

/** GET /api/v1/stats/genres. */
export interface GenresResponse extends License {
  scope: { platform: string | null; language: string | null; tags: TagSource };
  /** Stories in the scope (with a live listing), the shares' denominator. */
  totalStories: number;
  genres: GenreStat[];
}

export type Interval = "day" | "week" | "month";

/** GET /api/v1/stats/timeline. */
export interface TimelineResponse extends License {
  scope: {
    genre: string | null;
    platform: string | null;
    language: string | null;
    tags: TagSource;
    interval: Interval;
  };
  /** What each series means, in words. */
  notes: { snapshots: string; firstSeen: string };
  /** Catalogue size at the end of each period, from nightly snapshots. */
  snapshots: { period: string; titles: number; stories: number }[];
  /** Titles our crawler first saw in each period; not release dates. */
  firstSeen: { period: string; titles: number }[];
}

// ---------------------------------------------------------------- dramas

/** One drama in a list. */
export interface ListedDrama {
  id: string;
  slug: string;
  url: string;
  title: string;
  language: string | null;
  genres: string[];
  episodeCount: number | null;
  releaseYear: number | null;
  /** Slugs of the apps with a live listing (that one only, when filtered by platform). */
  platforms: string[];
  /** When our crawler first saw the title; not a release date. */
  firstSeen: string;
}

/** A page of dramas, 50 at most. */
export interface DramaPage {
  page: number;
  perPage: 50;
  dramas: ListedDrama[];
  /** Null on a short (last) page. */
  nextPage: number | null;
}

/** GET /api/v1/dramas. */
export interface DramasResponse extends DramaPage, License {}

/** GET /api/v1/new. */
export interface NewDramasResponse extends DramaPage, License {
  /** now - days, the list's cut-off. */
  since: string;
}

export interface ChangeEvent {
  type: "created" | "updated" | "pulled";
  id: string;
  url: string;
  /** The app a listing was pulled from (`pulled` only). */
  platform: string | null;
  at: string;
}

/** GET /api/v1/changes. */
export interface ChangesResponse extends License {
  since: string;
  events: ChangeEvent[];
  /** The last event's time (or `since` when none): the next call's `since`. */
  next: string;
  /** False when the 1,000 limit cut the list short. */
  complete: boolean;
}

export interface WatchListing {
  platform: string;
  platformName: string;
  /** Our affiliate link where we have one; the app's homepage for an unverified listing. */
  link: string;
  language: string | null;
  dubbed: boolean;
  episodeCount: number | null;
  version: { id: string; url: string; title: string };
  lastChecked: string;
}

/** GET /api/v1/dramas/{id}/watch. */
export interface WatchResponse extends License {
  id: string;
  title: string;
  url: string;
  watch: WatchListing[];
}

export interface MatchVersion {
  id: string;
  url: string;
  title: string;
  language: string | null;
  /** `original`, or the version's kind (dub, language, ...). */
  kind: string;
  label: string | null;
  listings: {
    platform: string;
    platformShowId: string | null;
    platformUrl: string;
    unverified: boolean;
  }[];
}

/** GET /api/v1/dramas/{id}/matches. */
export interface MatchesResponse extends License {
  /** The original version's public id. */
  story: string;
  versions: MatchVersion[];
}

// ---------------------------------------------------------------- charts

/** GET /api/v1/dramas/{id}/chart. */
export interface DramaChartResponse extends License {
  id: string;
  title: string;
  weeksOnChart: number;
  /** Best rank; null when never on the chart. */
  peak: number | null;
  weeks: { week: IsoWeek; rank: number; move: ChartMove; lastWeek: number | null }[];
}

/** GET /api/v1/charts/weekly. */
export interface ChartWeeksResponse extends License {
  weeks: { week: IsoWeek; startsOn: string; url: string }[];
}

export interface ChartEntry {
  rank: number;
  move: ChartMove;
  lastWeek: number | null;
  peak: number;
  weeksOnChart: number;
  id: string;
  title: string;
  url: string;
}

/** GET /api/v1/charts/weekly/{week}. */
export interface ChartWeekResponse extends License {
  week: IsoWeek;
  startsOn: string;
  entries: ChartEntry[];
}

// ------------------------------------------------------------ parameters

/** The scope filters most data endpoints share. Empty means "all". */
export interface ScopeParams {
  /** An app's slug, as `getStatsPlatforms()` lists them (e.g. `dramabox`). */
  platform?: string;
  /** A language code such as `eng`, `spa`, `ind`. */
  language?: string;
}

export interface GenresParams extends ScopeParams {
  tags?: TagSource;
}

export interface TimelineParams extends GenresParams {
  /** A genre tag exactly as `getStatsGenres()` lists it. Without it, the whole scope. */
  genre?: string;
  interval?: Interval;
}

export interface ListDramasParams extends ScopeParams {
  genre?: string;
  sort?: "new" | "popular";
  /** 1 to 200. */
  page?: number;
}

export interface NewDramasParams extends ScopeParams {
  genre?: string;
  /** 1 to 31 (default 7). */
  days?: number;
  /** 1 to 200. */
  page?: number;
}

export interface FeedParams extends ScopeParams {
  genre?: string;
}

export interface ChangesParams {
  /** An ISO 8601 time (or date) within the last 31 days; default 24 hours ago. */
  since?: string | Date;
}

// ------------------------------------------------------------ rate limit

/** The rate-limit headers of the last response; a field is null when absent. */
export interface RateLimit {
  /** Requests allowed per minute. */
  limit: number | null;
  /** Requests left in the current minute. */
  remaining: number | null;
  /** When the minute window resets, in Unix seconds. */
  reset: number | null;
  /** Requests allowed per UTC day (token endpoints only). */
  dailyLimit: number | null;
  /** Requests left today (token endpoints only). */
  dailyRemaining: number | null;
}
