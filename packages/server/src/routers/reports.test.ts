import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, sources, categories, transactions } from '../db';
import { sql } from 'drizzle-orm';

describe('reports router', () => {
  let sourceId: number;
  let groceriesId: number;
  let transferId: number;

  beforeEach(async () => {
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM rules`);
    await db.run(sql`DELETE FROM sources`);
    await db.run(sql`DELETE FROM categories`);

    const [source] = await db.insert(sources).values({
      name: 'Bank',
      type: 'bank',
      columnMapping: '{}',
    }).returning();
    sourceId = source.id;

    const [groceries] = await db.insert(categories).values({ name: 'Groceries' }).returning();
    groceriesId = groceries.id;

    const [transfer] = await db.insert(categories).values({ name: 'Transfer', isTransfer: true }).returning();
    transferId = transfer.id;
  });

  it('should return monthly breakdown', async () => {
    await db.insert(transactions).values([
      { sourceId, hash: 'a', date: '2024-01-15', amount: -100, description: 'x', normalizedDescription: 'x', categoryId: groceriesId },
      { sourceId, hash: 'b', date: '2024-01-20', amount: -50, description: 'y', normalizedDescription: 'y', categoryId: groceriesId },
    ]);

    const caller = appRouter.createCaller({});
    const result = await caller.reports.monthly({ year: 2024, month: 1 });

    const groceriesTotal = result.find(r => r.categoryId === groceriesId);
    expect(groceriesTotal?.total).toBe(-150);
  });

  it('should mark transfers correctly', async () => {
    await db.insert(transactions).values({
      sourceId, hash: 'c', date: '2024-01-15', amount: -500, description: 'z', normalizedDescription: 'z', categoryId: transferId,
    });

    const caller = appRouter.createCaller({});
    const result = await caller.reports.monthly({ year: 2024, month: 1 });

    const transferTotal = result.find(r => r.categoryId === transferId);
    expect(transferTotal?.isTransfer).toBe(true);
  });

  it('should return annual breakdown', async () => {
    await db.insert(transactions).values([
      { sourceId, hash: 'd', date: '2024-01-15', amount: -100, description: 'x', normalizedDescription: 'x', categoryId: groceriesId },
      { sourceId, hash: 'e', date: '2024-06-15', amount: -200, description: 'y', normalizedDescription: 'y', categoryId: groceriesId },
    ]);

    const caller = appRouter.createCaller({});
    const result = await caller.reports.annual({ year: 2024 });

    const groceriesTotal = result.find(r => r.categoryId === groceriesId);
    expect(groceriesTotal?.total).toBe(-300);
  });

  it('should handle uncategorized transactions', async () => {
    await db.insert(transactions).values({
      sourceId, hash: 'f', date: '2024-01-15', amount: -75, description: 'unknown', normalizedDescription: 'unknown',
    });

    const caller = appRouter.createCaller({});
    const result = await caller.reports.monthly({ year: 2024, month: 1 });

    const uncategorized = result.find(r => r.categoryId === null);
    expect(uncategorized?.categoryName).toBe('Uncategorized');
    expect(uncategorized?.total).toBe(-75);
  });
});
