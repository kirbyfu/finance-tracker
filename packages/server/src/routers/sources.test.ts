import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, sources } from '../db';
import { sql } from 'drizzle-orm';

describe('sources router', () => {
  beforeEach(async () => {
    // Clear in FK-safe order: transactions -> rules -> categories -> sources
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM rules`);
    await db.run(sql`DELETE FROM categories`);
    await db.run(sql`DELETE FROM sources`);
  });

  it('should list sources', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.sources.list();
    expect(result).toEqual([]);
  });

  it('should create a source', async () => {
    const caller = appRouter.createCaller({});
    const source = await caller.sources.create({
      name: 'Chase Bank',
      type: 'bank',
      columnMapping: {
        date: 'Post Date',
        description: 'Description',
        debit: 'Debit',
        credit: 'Credit',
        balance: 'Balance',
      },
    });
    expect(source.name).toBe('Chase Bank');
    expect(source.type).toBe('bank');
  });

  it('should update a source', async () => {
    const caller = appRouter.createCaller({});
    const source = await caller.sources.create({
      name: 'Test',
      type: 'bank',
      columnMapping: { date: 'Date', description: 'Desc', amount: 'Amount' },
    });
    const updated = await caller.sources.update({ id: source.id, name: 'Updated' });
    expect(updated.name).toBe('Updated');
  });

  it('should delete a source', async () => {
    const caller = appRouter.createCaller({});
    const source = await caller.sources.create({
      name: 'ToDelete',
      type: 'credit_card',
      columnMapping: { date: 'Date', description: 'Desc', amount: 'Amount' },
    });
    await caller.sources.delete({ id: source.id });
    const list = await caller.sources.list();
    expect(list).toEqual([]);
  });
});
