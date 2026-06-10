'use client';

/**
 * Filter controls for the radar. Writes to the radar slice (global UI state) so the grid
 * and any future active-filter chips read the same source via selectors. The text input
 * is debounced before dispatching to avoid a query per keystroke.
 */
import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setQuery, setLanguage, setType, type EntityTypeFilter } from './radarSlice';
import { TRACKED_LANGUAGES } from '@/config/tech';

const LANGS = ['', ...TRACKED_LANGUAGES];
const TYPES: { value: EntityTypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'repo', label: 'Repos' },
  { value: 'hn_story', label: 'HN' },
];

export function RadarSearchBar() {
  const dispatch = useAppDispatch();
  const { language, type } = useAppSelector((s) => s.radar);
  const [text, setText] = useState('');

  useEffect(() => {
    const id = setTimeout(() => dispatch(setQuery(text.trim())), 300);
    return () => clearTimeout(id);
  }, [text, dispatch]);

  return (
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search repos, topics…"
        aria-label="Search"
        className="flex-1 rounded-lg border border-border bg-bg-card px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent/50"
      />
      <select
        value={language ?? ''}
        onChange={(e) => dispatch(setLanguage(e.target.value || null))}
        aria-label="Language filter"
        className="rounded-lg border border-border bg-bg-card px-3 py-2 text-sm outline-none focus:border-accent/50"
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {l || 'All languages'}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-1">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => dispatch(setType(t.value))}
            className={`rounded-lg border px-3 py-2 text-sm transition ${
              type === t.value
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-border text-muted hover:text-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
