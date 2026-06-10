/**
 * Radar filter/sort UI state — genuinely global client state read by the results grid,
 * the active-filter chips, and the URL-sync effect. This is what Redux is FOR: shared,
 * cross-component UI state with selector-based, targeted re-renders (vs Context, which
 * would re-render every consumer on each keystroke).
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type EntityTypeFilter = 'repo' | 'topic' | 'hn_story' | 'all';

export interface RadarState {
  q: string;
  language: string | null;
  type: EntityTypeFilter;
}

const initialState: RadarState = { q: '', language: null, type: 'all' };

const radarSlice = createSlice({
  name: 'radar',
  initialState,
  reducers: {
    setQuery: (s, a: PayloadAction<string>) => {
      s.q = a.payload;
    },
    setLanguage: (s, a: PayloadAction<string | null>) => {
      s.language = a.payload;
    },
    setType: (s, a: PayloadAction<EntityTypeFilter>) => {
      s.type = a.payload;
    },
    resetFilters: () => initialState,
  },
});

export const { setQuery, setLanguage, setType, resetFilters } = radarSlice.actions;
export default radarSlice.reducer;
