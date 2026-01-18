import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const sources = sqliteTable('sources', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  type: text('type', { enum: ['bank', 'credit_card'] }).notNull(),
  columnMapping: text('column_mapping').notNull(), // JSON string
  hasHeaderRow: integer('has_header_row', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const categories = sqliteTable('categories', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  isTransfer: integer('is_transfer', { mode: 'boolean' }).notNull().default(false),
  color: text('color').notNull().default('#6b7280'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const transactions = sqliteTable('transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  sourceId: integer('source_id').notNull().references(() => sources.id),
  date: text('date').notNull(), // ISO date string YYYY-MM-DD
  amount: real('amount').notNull(),
  description: text('description').notNull(),
  balance: real('balance'),
  categoryId: integer('category_id').references(() => categories.id),
  manualCategoryId: integer('manual_category_id').references(() => categories.id),
  notes: text('notes'),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

export const rules = sqliteTable('rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  pattern: text('pattern').notNull(),
  categoryId: integer('category_id').notNull().references(() => categories.id),
  sourceId: integer('source_id').references(() => sources.id),
  priority: integer('priority').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

// Type exports for use in routers
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Rule = typeof rules.$inferSelect;
export type NewRule = typeof rules.$inferInsert;
