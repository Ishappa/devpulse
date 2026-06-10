/**
 * RTK Query API — client-side SERVER-STATE cache for authed / interactive views that
 * ISR can't serve. Handles request dedup, caching, optimistic updates, and tag
 * invalidation. Pure client UI state (filters, tray) lives in slices, not here.
 */
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Paginated, EntitySummary } from '@/schemas';

export interface SearchArgs {
  q?: string;
  lang?: string;
  type?: string;
  limit?: number;
}

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Watches', 'Feed'],
  endpoints: (builder) => ({
    // Infinite (cursor-paginated) search for the radar's infinite scroll.
    searchEntities: builder.infiniteQuery<Paginated<EntitySummary>, SearchArgs, string | null>({
      infiniteQueryOptions: {
        initialPageParam: null,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
      query: ({ queryArg, pageParam }) => ({
        url: 'search',
        params: {
          ...(queryArg.q ? { q: queryArg.q } : {}),
          ...(queryArg.lang ? { lang: queryArg.lang } : {}),
          ...(queryArg.type ? { type: queryArg.type } : {}),
          limit: queryArg.limit ?? 20,
          ...(pageParam ? { cursor: pageParam } : {}),
        },
      }),
    }),

    getWatches: builder.query<number[], void>({
      query: () => 'watches',
      transformResponse: (r: { data: number[] }) => r.data,
      providesTags: ['Watches'],
    }),

    getFeed: builder.query<EntitySummary[], void>({
      query: () => 'feed',
      transformResponse: (r: { data: EntitySummary[] }) => r.data,
      providesTags: ['Feed'],
    }),

    addWatch: builder.mutation<void, number>({
      query: (entityId) => ({ url: 'watches', method: 'POST', body: { entityId } }),
      // Optimistic: flip the watched set immediately, roll back on failure.
      async onQueryStarted(entityId, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          api.util.updateQueryData('getWatches', undefined, (draft) => {
            if (!draft.includes(entityId)) draft.push(entityId);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: ['Feed'],
    }),

    removeWatch: builder.mutation<void, number>({
      query: (entityId) => ({ url: 'watches', method: 'DELETE', body: { entityId } }),
      async onQueryStarted(entityId, { dispatch, queryFulfilled }) {
        const watchPatch = dispatch(
          api.util.updateQueryData('getWatches', undefined, (draft) => {
            const i = draft.indexOf(entityId);
            if (i >= 0) draft.splice(i, 1);
          }),
        );
        // Also remove from feed immediately so My Feed updates without waiting for refetch.
        const feedPatch = dispatch(
          api.util.updateQueryData('getFeed', undefined, (draft) => {
            const i = draft.findIndex((e) => e.id === entityId);
            if (i >= 0) draft.splice(i, 1);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          watchPatch.undo();
          feedPatch.undo();
        }
      },
      invalidatesTags: ['Feed'],
    }),
  }),
});

export const {
  useSearchEntitiesInfiniteQuery,
  useGetWatchesQuery,
  useGetFeedQuery,
  useAddWatchMutation,
  useRemoveWatchMutation,
} = api;
