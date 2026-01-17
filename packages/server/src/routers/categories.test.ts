import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db } from '../db';
import { sql } from 'drizzle-orm';

describe('categories router', () => {
  beforeEach(async () => {
    // Clear in FK-safe order: transactions -> rules -> categories
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM rules`);
    await db.run(sql`DELETE FROM categories`);
  });

  it('should list categories', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.categories.list();
    expect(result).toEqual([]);
  });

  it('should create a category', async () => {
    const caller = appRouter.createCaller({});
    const category = await caller.categories.create({
      name: 'Groceries',
      color: '#22c55e',
    });
    expect(category.name).toBe('Groceries');
    expect(category.isTransfer).toBe(false);
  });

  it('should create a transfer category', async () => {
    const caller = appRouter.createCaller({});
    const category = await caller.categories.create({
      name: 'Credit Card Payment',
      isTransfer: true,
    });
    expect(category.isTransfer).toBe(true);
  });

  it('should update a category', async () => {
    const caller = appRouter.createCaller({});
    const category = await caller.categories.create({
      name: 'Test',
      color: '#000000',
    });
    const updated = await caller.categories.update({
      id: category.id,
      name: 'Updated',
      color: '#ffffff',
    });
    expect(updated.name).toBe('Updated');
    expect(updated.color).toBe('#ffffff');
  });

  it('should delete a category', async () => {
    const caller = appRouter.createCaller({});
    const category = await caller.categories.create({
      name: 'ToDelete',
    });
    await caller.categories.delete({ id: category.id });
    const list = await caller.categories.list();
    expect(list).toEqual([]);
  });
});
