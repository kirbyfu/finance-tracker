import { eq, isNull, or } from 'drizzle-orm';
import { db, noisePhrases, transactions } from '../db';
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
  { phrase: string; transactionCount: number; sampleDescriptions: string[] }[]
> {
  // Find phrases appearing in 5+ transactions (based on cleaned descriptions)
  const allTransactions = await db
    .select({ cleanedDescription: transactions.cleanedDescription })
    .from(transactions);

  // Extract n-grams (1-4 words) from cleaned descriptions
  const ngramTxMap = new Map<string, Set<number>>();
  const ngramSamples = new Map<string, string[]>();

  for (let i = 0; i < allTransactions.length; i++) {
    const tx = allTransactions[i];
    const desc = tx.cleanedDescription || '';
    if (!desc) continue;
    const ngrams = extractNgrams(desc, 1, 4);
    for (const ngram of ngrams) {
      if (!ngramTxMap.has(ngram)) {
        ngramTxMap.set(ngram, new Set());
        ngramSamples.set(ngram, []);
      }
      ngramTxMap.get(ngram)!.add(i);
      const samples = ngramSamples.get(ngram)!;
      if (samples.length < 5 && !samples.includes(desc)) {
        samples.push(desc);
      }
    }
  }

  // Filter to n-grams appearing in 5+ transactions
  const candidates: { phrase: string; transactionCount: number; sampleDescriptions: string[] }[] = [];
  for (const [phrase, txIndices] of ngramTxMap) {
    if (txIndices.size >= 5) {
      candidates.push({
        phrase,
        transactionCount: txIndices.size,
        sampleDescriptions: ngramSamples.get(phrase) || [],
      });
    }
  }

  // Sort by transaction count descending, return top 20
  return candidates
    .sort((a, b) => b.transactionCount - a.transactionCount)
    .slice(0, 20);
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
      const ngram = words.slice(i, i + n).join(' ');
      // Skip single-word ngrams that are too short (< 3 chars) - typically codes/letters
      if (n === 1 && ngram.length < 3) continue;
      ngrams.push(ngram);
    }
  }

  return ngrams;
}
