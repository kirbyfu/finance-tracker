import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, sources, categories, rules } from '../db';
import { sql } from 'drizzle-orm';

describe('transactions router', () => {
  let sourceId: number;
  let categoryId: number;

  beforeEach(async () => {
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM rules`);
    await db.run(sql`DELETE FROM sources`);
    await db.run(sql`DELETE FROM categories`);

    const [source] = await db.insert(sources).values({
      name: 'Test Bank',
      type: 'bank',
      columnMapping: JSON.stringify({
        date: 'Date',
        description: 'Description',
        amount: 'Amount',
      }),
    }).returning();
    sourceId = source.id;

    const [cat] = await db.insert(categories).values({ name: 'Shopping' }).returning();
    categoryId = cat.id;
  });

  it('should import transactions from CSV', async () => {
    const caller = appRouter.createCaller({});
    const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00
2024-01-16,DEPOSIT,1000.00`;

    const result = await caller.transactions.import({ sourceId, csvContent: csv });
    expect(result.imported).toBe(2);
    expect(result.duplicates).toBe(0);
  });

  it('should skip duplicate transactions', async () => {
    const caller = appRouter.createCaller({});
    const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00`;

    await caller.transactions.import({ sourceId, csvContent: csv });
    const result = await caller.transactions.import({ sourceId, csvContent: csv });
    expect(result.imported).toBe(0);
    expect(result.duplicates).toBe(1);
  });

  it('should auto-categorize with rules', async () => {
    const caller = appRouter.createCaller({});

    await db.insert(rules).values({
      pattern: 'AMAZON',
      categoryId,
      priority: 0,
    });

    const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00`;

    await caller.transactions.import({ sourceId, csvContent: csv });
    const txs = await caller.transactions.list();
    expect(txs[0].categoryId).toBe(categoryId);
  });

  it('should list transactions', async () => {
    const caller = appRouter.createCaller({});
    const csv = `Date,Description,Amount
2024-01-15,TEST,-10.00`;
    await caller.transactions.import({ sourceId, csvContent: csv });

    const result = await caller.transactions.list();
    expect(result.length).toBe(1);
    expect(result[0].description).toBe('TEST');
  });

  it('should update transaction', async () => {
    const caller = appRouter.createCaller({});
    const csv = `Date,Description,Amount
2024-01-15,TEST,-10.00`;
    await caller.transactions.import({ sourceId, csvContent: csv });

    const txs = await caller.transactions.list();
    const updated = await caller.transactions.update({
      id: txs[0].id,
      notes: 'Test note',
    });
    expect(updated.notes).toBe('Test note');
  });

  it('should delete transaction', async () => {
    const caller = appRouter.createCaller({});
    const csv = `Date,Description,Amount
2024-01-15,TEST,-10.00`;
    await caller.transactions.import({ sourceId, csvContent: csv });

    const txs = await caller.transactions.list();
    await caller.transactions.delete({ id: txs[0].id });

    const result = await caller.transactions.list();
    expect(result.length).toBe(0);
  });
});
