/**
 * Comparison tray — pin up to 4 entities to overlay their sparklines. Persists across
 * route changes, so it's global client state (a textbook Redux use case).
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export const MAX_COMPARE = 4;

export interface CompareState {
  ids: number[];
}

const initialState: CompareState = { ids: [] };

const compareSlice = createSlice({
  name: 'compare',
  initialState,
  reducers: {
    toggle: (s, a: PayloadAction<number>) => {
      const i = s.ids.indexOf(a.payload);
      if (i >= 0) s.ids.splice(i, 1);
      else if (s.ids.length < MAX_COMPARE) s.ids.push(a.payload);
    },
    clear: (s) => {
      s.ids = [];
    },
  },
});

export const { toggle, clear } = compareSlice.actions;
export default compareSlice.reducer;
