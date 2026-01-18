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

  it('should import transactions from headerless CSV using column indices', async () => {
    // Create a source with hasHeaderRow=false and numeric column mapping
    const [headerlessSource] = await db.insert(sources).values({
      name: 'Headerless Bank',
      type: 'bank',
      hasHeaderRow: false,
      columnMapping: JSON.stringify({
        date: 1,
        description: 2,
        amount: 3,
      }),
    }).returning();

    const caller = appRouter.createCaller({});
    const csv = `2024-01-15,AMAZON PURCHASE,-50.00
2024-01-16,DEPOSIT,1000.00`;

    const result = await caller.transactions.import({
      sourceId: headerlessSource.id,
      csvContent: csv
    });

    expect(result.imported).toBe(2);

    const txs = await caller.transactions.list({ sourceId: headerlessSource.id });
    expect(txs).toHaveLength(2);
    expect(txs.find(t => t.description === 'AMAZON PURCHASE')).toBeDefined();
    expect(txs.find(t => t.description === 'DEPOSIT')).toBeDefined();
  });

  describe('recategorizeAll', () => {
    it('should recategorize transactions when rules change', async () => {
      const caller = appRouter.createCaller({});

      // Create a rule and import a matching transaction
      await db.insert(rules).values({
        pattern: 'AMAZON',
        categoryId,
        priority: 0,
      });

      const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00`;

      await caller.transactions.import({ sourceId, csvContent: csv });
      let txs = await caller.transactions.list();
      expect(txs[0].categoryId).toBe(categoryId);

      // Create a new category and update the rule
      const [newCat] = await db.insert(categories).values({ name: 'Online Shopping' }).returning();
      await db.run(sql`UPDATE rules SET category_id = ${newCat.id}`);

      // Recategorize
      const result = await caller.transactions.recategorizeAll();
      expect(result.updated).toBe(1);

      txs = await caller.transactions.list();
      expect(txs[0].categoryId).toBe(newCat.id);
    });

    it('should clear category when no rule matches', async () => {
      const caller = appRouter.createCaller({});

      // Create a rule and import a matching transaction
      await db.insert(rules).values({
        pattern: 'AMAZON',
        categoryId,
        priority: 0,
      });

      const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00`;

      await caller.transactions.import({ sourceId, csvContent: csv });
      let txs = await caller.transactions.list();
      expect(txs[0].categoryId).toBe(categoryId);

      // Delete the rule
      await db.run(sql`DELETE FROM rules`);

      // Recategorize - should clear the category
      const result = await caller.transactions.recategorizeAll();
      expect(result.updated).toBe(1);

      txs = await caller.transactions.list();
      expect(txs[0].categoryId).toBeNull();
    });

    it('should not update transactions with manual category', async () => {
      const caller = appRouter.createCaller({});

      const csv = `Date,Description,Amount
2024-01-15,AMAZON PURCHASE,-50.00`;

      await caller.transactions.import({ sourceId, csvContent: csv });
      let txs = await caller.transactions.list();

      // Manually set category
      await caller.transactions.update({
        id: txs[0].id,
        manualCategoryId: categoryId,
      });

      // Create a rule that would match
      const [newCat] = await db.insert(categories).values({ name: 'Other' }).returning();
      await db.insert(rules).values({
        pattern: 'AMAZON',
        categoryId: newCat.id,
        priority: 0,
      });

      // Recategorize - should not affect manual categorization
      const result = await caller.transactions.recategorizeAll();
      expect(result.updated).toBe(0);

      txs = await caller.transactions.list();
      expect(txs[0].manualCategoryId).toBe(categoryId);
    });
  });

  describe('sorting', () => {
    beforeEach(async () => {
      const caller = appRouter.createCaller({});
      // Import transactions with different dates and amounts
      const csv = `Date,Description,Amount
2024-01-10,SMALL PURCHASE,-10.00
2024-01-15,LARGE PURCHASE,-500.00
2024-01-12,MEDIUM PURCHASE,-100.00`;
      await caller.transactions.import({ sourceId, csvContent: csv });
    });

    it('sorts by date ascending', async () => {
      const caller = appRouter.createCaller({});
      const result = await caller.transactions.list({
        sort: 'date',
        order: 'asc',
      });

      for (let i = 1; i < result.length; i++) {
        expect(result[i].date >= result[i - 1].date).toBe(true);
      }
    });

    it('sorts by date descending (default)', async () => {
      const caller = appRouter.createCaller({});
      const result = await caller.transactions.list({
        sort: 'date',
        order: 'desc',
      });

      for (let i = 1; i < result.length; i++) {
        expect(result[i].date <= result[i - 1].date).toBe(true);
      }
    });

    it('sorts by amount ascending', async () => {
      const caller = appRouter.createCaller({});
      const result = await caller.transactions.list({
        sort: 'amount',
        order: 'asc',
      });

      for (let i = 1; i < result.length; i++) {
        expect(result[i].amount >= result[i - 1].amount).toBe(true);
      }
    });

    it('sorts by amount descending', async () => {
      const caller = appRouter.createCaller({});
      const result = await caller.transactions.list({
        sort: 'amount',
        order: 'desc',
      });

      for (let i = 1; i < result.length; i++) {
        expect(result[i].amount <= result[i - 1].amount).toBe(true);
      }
    });
  });
});
