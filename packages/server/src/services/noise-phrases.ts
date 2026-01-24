import { eq, isNull, or } from 'drizzle-orm';
import { db, noisePhrases, transactions, categories } from '../db';
import type { NoisePhrase } from '../db/schema';

export async function list(): Promise<NoisePhrase[]> {
  return db.select().from(noisePhrases);
}

export async function create(
  phrase: string,
  sourceId?: number | null
): Promise<NoisePhrase> {
  const normalized = phrase.toLowerCase().trim();
  const [inserted] = await db
    .insert(noisePhrases)
    .values({ phrase: normalized, sourceId: sourceId ?? null })
    .returning();

  // Recompute affected cleaned_descriptions
  await recomputeCleanedDescriptions(sourceId ?? undefined);

  return inserted;
}

export async function remove(id: number): Promise<void> {
  const [phrase] = await db
    .select()
    .from(noisePhrases)
    .where(eq(noisePhrases.id, id));

  if (!phrase) return;

  await db.delete(noisePhrases).where(eq(noisePhrases.id, id));

  // Recompute affected cleaned_descriptions
  await recomputeCleanedDescriptions(phrase.sourceId ?? undefined);
}

export async function getSuggestions(): Promise<
  { phrase: string; categoryCount: number; sampleCategories: string[] }[]
> {
  // Find phrases appearing in 3+ different categories
  const allTransactions = await db
    .select({
      description: transactions.description,
      categoryId: transactions.categoryId,
    })
    .from(transactions);

  const allCategories = await db.select().from(categories);
  const categoryMap = new Map(allCategories.map((c) => [c.id, c.name]));

  // Extract n-grams (1-4 words) from descriptions
  const ngramCategoryMap = new Map<string, Set<number>>();

  for (const tx of allTransactions) {
    if (!tx.categoryId) continue;
    const ngrams = extractNgrams(tx.description, 1, 4);
    for (const ngram of ngrams) {
      if (!ngramCategoryMap.has(ngram)) {
        ngramCategoryMap.set(ngram, new Set());
      }
      ngramCategoryMap.get(ngram)!.add(tx.categoryId);
    }
  }

  // Filter to n-grams appearing in 3+ categories
  const candidates: { phrase: string; categoryCount: number; sampleCategories: string[] }[] = [];
  for (const [phrase, categoryIds] of ngramCategoryMap) {
    if (categoryIds.size >= 3) {
      candidates.push({
        phrase,
        categoryCount: categoryIds.size,
        sampleCategories: Array.from(categoryIds)
          .slice(0, 3)
          .map((id) => categoryMap.get(id) || 'Unknown'),
      });
    }
  }

  // Sort by category count descending, return top 10
  return candidates
    .sort((a, b) => b.categoryCount - a.categoryCount)
    .slice(0, 10);
}

export async function recomputeCleanedDescriptions(
  sourceId?: number
): Promise<{ updated: number }> {
  // Get all applicable phrases
  const phrases = await db.select().from(noisePhrases);
  const globalPhrases = phrases.filter((p) => p.sourceId === null);

  // Get transactions to update
  const txQuery = sourceId
    ? db.select().from(transactions).where(eq(transactions.sourceId, sourceId))
    : db.select().from(transactions);

  const txs = await txQuery;

  let updated = 0;
  for (const tx of txs) {
    const applicablePhrases = [
      ...globalPhrases,
      ...phrases.filter((p) => p.sourceId === tx.sourceId),
    ];
    const cleaned = applyNoiseFilters(tx.description, applicablePhrases);

    if (cleaned !== tx.cleanedDescription) {
      await db
        .update(transactions)
        .set({ cleanedDescription: cleaned })
        .where(eq(transactions.id, tx.id));
      updated++;
    }
  }

  return { updated };
}

export function cleanDescription(
  description: string,
  phrases: NoisePhrase[]
): string {
  return applyNoiseFilters(description, phrases);
}

export async function getPhrasesForSource(
  sourceId: number
): Promise<NoisePhrase[]> {
  // Get global + source-specific phrases
  return db
    .select()
    .from(noisePhrases)
    .where(or(isNull(noisePhrases.sourceId), eq(noisePhrases.sourceId, sourceId)));
}

// --- Internal helpers ---

function applyNoiseFilters(description: string, phrases: NoisePhrase[]): string {
  let result = description;

  for (const p of phrases) {
    // Case-insensitive replacement
    const regex = new RegExp(escapeRegex(p.phrase), 'gi');
    result = result.replace(regex, '');
  }

  // Trim and collapse whitespace
  return result.replace(/\s+/g, ' ').trim();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractNgrams(text: string, minN: number, maxN: number): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const ngrams: string[] = [];

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.push(words.slice(i, i + n).join(' '));
    }
  }

  return ngrams;
}
