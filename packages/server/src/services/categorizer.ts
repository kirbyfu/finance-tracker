import { asc, eq, isNull } from 'drizzle-orm';
import { db, rules, transactions } from '../db';

export async function categorizeTransaction(
  description: string,
  sourceId: number
): Promise<number | null> {
  const allRules = await db.select().from(rules).orderBy(asc(rules.priority));

  for (const rule of allRules) {
    // Skip if rule is source-specific and doesn't match
    if (rule.sourceId && rule.sourceId !== sourceId) continue;

    try {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(description)) {
        return rule.categoryId;
      }
    } catch {
      // Invalid regex, skip
    }
  }

  return null;
}

export async function recategorizeAll(): Promise<{ updated: number }> {
  const uncategorized = await db
    .select()
    .from(transactions)
    .where(isNull(transactions.manualCategoryId));

  let updated = 0;
  for (const tx of uncategorized) {
    const categoryId = await categorizeTransaction(tx.description, tx.sourceId);
    if (categoryId !== tx.categoryId) {
      await db.update(transactions).set({ categoryId }).where(eq(transactions.id, tx.id));
      updated++;
    }
  }

  return { updated };
}
