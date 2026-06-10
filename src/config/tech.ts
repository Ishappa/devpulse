/**
 * Central config for tracked technologies.
 * Edit THIS file to add/remove languages across the entire app —
 * trending page filters, radar search dropdown, and ingest pipeline
 * all read from here.
 */

export const TRACKED_LANGUAGES = [
  'TypeScript',
  'JavaScript',
  'Java',
  'Kotlin',
  'Swift',
  'Python'
] as const;

export type TrackedLanguage = (typeof TRACKED_LANGUAGES)[number];

/** Lowercase slugs used in URL routes like /trending/typescript */
export const LANGUAGE_SLUGS = TRACKED_LANGUAGES.map((l) => l.toLowerCase());

/** How many repos to fetch per language per ingest cycle */
export const REPOS_PER_LANGUAGE = 5;

/** How many days back to search for trending repos */
export const TRENDING_DAYS = 30;

/** How many HN top stories to resolve per ingest cycle */
export const HN_STORIES_LIMIT = 15;
