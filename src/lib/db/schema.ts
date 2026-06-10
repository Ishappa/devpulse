/**
 * DevPulse database schema (Drizzle ORM / Postgres).
 *
 * Design notes:
 *  - `snapshots` is an append-only time series — one row per entity per ingest run.
 *  - Derived values (`starsDelta`, `momentumScore`) are computed on the WRITE path
 *    (ingest worker) and persisted, so the READ path is a plain indexed select.
 *  - Unique constraints double as the idempotency keys for at-least-once queue retries.
 */
import {
  pgTable,
  pgEnum,
  bigserial,
  bigint,
  text,
  timestamp,
  integer,
  numeric,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const entityType = pgEnum('entity_type', ['repo', 'topic', 'hn_story']);

// ── entities: the thing being tracked (a repo, a topic, an HN story) ──────────
export const entities = pgTable(
  'entities',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    type: entityType('type').notNull(),
    sourceKey: text('source_key').notNull(), // e.g. 'vercel/next.js' or an HN item id
    name: text('name').notNull(),
    url: text('url'),
    description: text('description'),
    language: text('language'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Idempotent upsert target + natural lookup key.
    typeSourceKeyUq: uniqueIndex('entities_type_source_key_uq').on(t.type, t.sourceKey),
    languageIdx: index('entities_language_idx').on(t.language),
  }),
);

// ── snapshots: append-only time series of metrics + derived momentum ──────────
export const snapshots = pgTable(
  'snapshots',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    entityId: bigint('entity_id', { mode: 'number' })
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    stars: integer('stars'),
    starsDelta: integer('stars_delta'), // vs previous snapshot, pre-computed on write
    hnPoints: integer('hn_points'),
    hnComments: integer('hn_comments'),
    momentumScore: numeric('momentum_score', { precision: 8, scale: 3 }).notNull(),
  },
  (t) => ({
    // Prevents duplicate snapshots on queue retries (at-least-once delivery).
    entityCapturedUq: uniqueIndex('snapshots_entity_captured_uq').on(t.entityId, t.capturedAt),
    // Powers "latest snapshot per entity" via DISTINCT ON — the hottest query.
    latestIdx: index('snapshots_latest_idx').on(t.entityId, t.capturedAt.desc()),
    // Powers the trending leaderboard for a given time bucket.
    scoreIdx: index('snapshots_score_idx').on(t.capturedAt.desc(), t.momentumScore.desc()),
  }),
);

// ── users ─────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  githubId: bigint('github_id', { mode: 'number' }).notNull().unique(),
  email: text('email'),
  name: text('name'),
  imageUrl: text('image_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── watches: a user's personalized watchlist ────────────────────────────────
export const watches = pgTable(
  'watches',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    entityId: bigint('entity_id', { mode: 'number' })
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userEntityUq: uniqueIndex('watches_user_entity_uq').on(t.userId, t.entityId),
  }),
);

// ── tech tags (M:N with entities) ───────────────────────────────────────────
export const techTags = pgTable('tech_tags', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const entityTags = pgTable(
  'entity_tags',
  {
    entityId: bigint('entity_id', { mode: 'number' })
      .notNull()
      .references(() => entities.id, { onDelete: 'cascade' }),
    tagId: bigint('tag_id', { mode: 'number' })
      .notNull()
      .references(() => techTags.id, { onDelete: 'cascade' }),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.entityId, t.tagId] }),
  }),
);

// ── relations (for query-builder convenience) ───────────────────────────────
export const entitiesRelations = relations(entities, ({ many }) => ({
  snapshots: many(snapshots),
  watches: many(watches),
  entityTags: many(entityTags),
}));

export const snapshotsRelations = relations(snapshots, ({ one }) => ({
  entity: one(entities, { fields: [snapshots.entityId], references: [entities.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  watches: many(watches),
}));

export const watchesRelations = relations(watches, ({ one }) => ({
  user: one(users, { fields: [watches.userId], references: [users.id] }),
  entity: one(entities, { fields: [watches.entityId], references: [entities.id] }),
}));

export const entityTagsRelations = relations(entityTags, ({ one }) => ({
  entity: one(entities, { fields: [entityTags.entityId], references: [entities.id] }),
  tag: one(techTags, { fields: [entityTags.tagId], references: [techTags.id] }),
}));

// ── inferred types ──────────────────────────────────────────────────────────
export type Entity = typeof entities.$inferSelect;
export type NewEntity = typeof entities.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
export type User = typeof users.$inferSelect;
export type Watch = typeof watches.$inferSelect;
export type EntityTypeValue = (typeof entityType.enumValues)[number];
