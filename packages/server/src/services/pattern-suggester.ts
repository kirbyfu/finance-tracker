import { eq, isNull, and } from 'drizzle-orm';
import { db, transactions } from '../db';

export interface PatternSuggestion {
  pattern: string;
  matchCount: number;
  sampleDescriptions: string[];
}

export interface DetectedNoise {
  phrase: string;
  categoryCount: number;
}

export interface SuggestionsResult {
  patterns: PatternSuggestion[];
  detectedNoise: DetectedNoise[];
}

/**
 * Get pattern suggestions for a transaction or all uncategorized transactions.
 * Uses cleaned_description for n-gram extraction, raw description for noise detection.
 */
export async function getSuggestions(transactionId?: number): Promise<SuggestionsResult> {
  // Get target cleaned description(s)
  let targetDescriptions: string[];
  let rawDescription: string | null = null;

  if (transactionId) {
    const [tx] = await db
      .select({
        cleanedDescription: transactions.cleanedDescription,
        description: transactions.description,
      })
      .from(transactions)
      .where(eq(transactions.id, transactionId));

    if (!tx || !tx.cleanedDescription) {
      return { patterns: [], detectedNoise: [] };
    }
    targetDescriptions = [tx.cleanedDescription];
    rawDescription = tx.description;
  } else {
    // All uncategorized transactions
    const uncategorized = await db
      .select({ cleanedDescription: transactions.cleanedDescription })
      .from(transactions)
      .where(and(isNull(transactions.categoryId), isNull(transactions.manualCategoryId)));

    targetDescriptions = uncategorized
      .map((t) => t.cleanedDescription)
      .filter((d): d is string => !!d);

    if (targetDescriptions.length === 0) {
      return { patterns: [], detectedNoise: [] };
    }
  }

  // Get all cleaned descriptions for matching
  const allTxs = await db
    .select({ cleanedDescription: transactions.cleanedDescription })
    .from(transactions);

  const allCleanedDescriptions = allTxs
    .map((t) => t.cleanedDescription)
    .filter((d): d is string => !!d);

  // Extract n-grams from target descriptions
  const ngramCounts = new Map<string, { count: number; samples: Set<string> }>();

  for (const desc of targetDescriptions) {
    const ngrams = extractNgrams(desc, 1, 4);
    for (const ngram of ngrams) {
      if (!ngramCounts.has(ngram)) {
        // Count matches across all cleaned descriptions
        const matches = allCleanedDescriptions.filter((d) =>
          d.toLowerCase().includes(ngram)
        );
        if (matches.length >= 2) {
          ngramCounts.set(ngram, {
            count: matches.length,
            samples: new Set(matches.slice(0, 3)),
          });
        }
      }
    }
  }

  // Convert to patterns, sort by match count
  const patterns: PatternSuggestion[] = [];
  for (const [ngram, data] of ngramCounts) {
    patterns.push({
      pattern: ngramToRegex(ngram),
      matchCount: data.count,
      sampleDescriptions: Array.from(data.samples),
    });
  }

  patterns.sort((a, b) => b.matchCount - a.matchCount);
  const topPatterns = dedupePatterns(patterns).slice(0, 5);

  // Detect noise from raw description (if single transaction)
  let detectedNoise: DetectedNoise[] = [];
  if (rawDescription) {
    detectedNoise = await detectNoise(rawDescription);
  }

  return { patterns: topPatterns, detectedNoise };
}

/**
 * Detect n-grams in raw description that appear across 3+ categories.
 * These are likely noise phrases.
 */
async function detectNoise(rawDescription: string): Promise<DetectedNoise[]> {
  const ngrams = extractNgrams(rawDescription.toLowerCase(), 1, 4);

  // Get all transactions with categories
  const allTxs = await db
    .select({
      description: transactions.description,
      categoryId: transactions.categoryId,
    })
    .from(transactions);

  // Count categories per n-gram
  const ngramCategories = new Map<string, Set<number>>();
  for (const ngram of ngrams) {
    ngramCategories.set(ngram, new Set());
  }

  for (const tx of allTxs) {
    if (!tx.categoryId) continue;
    const txLower = tx.description.toLowerCase();
    for (const ngram of ngrams) {
      if (txLower.includes(ngram)) {
        ngramCategories.get(ngram)!.add(tx.categoryId);
      }
    }
  }

  // Filter to n-grams in 3+ categories
  const noise: DetectedNoise[] = [];
  for (const [phrase, categoryIds] of ngramCategories) {
    if (categoryIds.size >= 3) {
      noise.push({
        phrase,
        categoryCount: categoryIds.size,
      });
    }
  }

  // Sort by category count, dedupe, return top 5
  noise.sort((a, b) => b.categoryCount - a.categoryCount);
  return dedupeNoise(noise).slice(0, 5);
}

/**
 * Extract n-grams (1-4 words) from text.
 */
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

/**
 * Convert n-gram to regex pattern with word boundaries and flexible whitespace.
 */
function ngramToRegex(ngram: string): string {
  const words = ngram.split(/\s+/);
  const escaped = words.map((w) => escapeRegex(w));
  return `\\b${escaped.join('\\s+')}\\b`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remove patterns that are substrings of higher-count patterns.
 */
function dedupePatterns(patterns: PatternSuggestion[]): PatternSuggestion[] {
  const result: PatternSuggestion[] = [];

  for (const pattern of patterns) {
    // Extract the core text from the regex pattern
    const coreText = pattern.pattern
      .replace(/\\b/g, '')
      .replace(/\\s\+/g, ' ')
      .toLowerCase();

    const isDupe = result.some((existing) => {
      const existingCore = existing.pattern
        .replace(/\\b/g, '')
        .replace(/\\s\+/g, ' ')
        .toLowerCase();
      return existingCore.includes(coreText);
    });

    if (!isDupe) {
      result.push(pattern);
    }
  }

  return result;
}

/**
 * Remove noise phrases that are substrings of higher-count phrases.
 */
function dedupeNoise(noise: DetectedNoise[]): DetectedNoise[] {
  const result: DetectedNoise[] = [];

  for (const n of noise) {
    const isDupe = result.some((existing) =>
      existing.phrase.includes(n.phrase)
    );
    if (!isDupe) {
      result.push(n);
    }
  }

  return result;
}
