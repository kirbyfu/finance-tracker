import { describe, it, expect, beforeEach } from 'vitest';
import { appRouter } from './index';
import { db, categories } from '../db';
import { sql } from 'drizzle-orm';

describe('rules router', () => {
  let categoryId: number;

  beforeEach(async () => {
    await db.run(sql`DELETE FROM rules`);
    await db.run(sql`DELETE FROM categories`);
    const [cat] = await db.insert(categories).values({ name: 'Test Category' }).returning();
    categoryId = cat.id;
  });

  it('should list rules ordered by priority', async () => {
    const caller = appRouter.createCaller({});
    const result = await caller.rules.list();
    expect(result).toEqual([]);
  });

  it('should create a rule', async () => {
    const caller = appRouter.createCaller({});
    const rule = await caller.rules.create({
      pattern: 'UBER|LYFT',
      categoryId,
      priority: 1,
    });
    expect(rule.pattern).toBe('UBER|LYFT');
    expect(rule.priority).toBe(1);
  });

  it('should update a rule', async () => {
    const caller = appRouter.createCaller({});
    const rule = await caller.rules.create({
      pattern: 'OLD',
      categoryId,
      priority: 0,
    });
    const updated = await caller.rules.update({
      id: rule.id,
      pattern: 'NEW',
    });
    expect(updated.pattern).toBe('NEW');
  });

  it('should delete a rule', async () => {
    const caller = appRouter.createCaller({});
    const rule = await caller.rules.create({
      pattern: 'TODELETE',
      categoryId,
      priority: 0,
    });
    await caller.rules.delete({ id: rule.id });
    const list = await caller.rules.list();
    expect(list).toEqual([]);
  });

  it('should reorder rules', async () => {
    const caller = appRouter.createCaller({});
    const r1 = await caller.rules.create({ pattern: 'A', categoryId, priority: 1 });
    const r2 = await caller.rules.create({ pattern: 'B', categoryId, priority: 2 });

    await caller.rules.reorder({ ids: [r2.id, r1.id] });

    const rules = await caller.rules.list();
    expect(rules[0].id).toBe(r2.id);
    expect(rules[0].priority).toBe(0);
    expect(rules[1].id).toBe(r1.id);
    expect(rules[1].priority).toBe(1);
  });
});
