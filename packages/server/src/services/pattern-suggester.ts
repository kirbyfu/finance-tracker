import { db, transactions } from '../db';
import { isNull, and } from 'drizzle-orm';

export interface PatternSuggestion {
  pattern: string;
  matchCount: number;
  sampleDescriptions: string[];
}

/**
 * Analyzes uncategorized transaction descriptions to find common patterns.
 * Returns suggested regex patterns that would match multiple transactions.
 */
export async function getSuggestedPatterns(): Promise<PatternSuggestion[]> {
  // Get all uncategorized transactions
  const uncategorized = await db
    .select({ description: transactions.description })
    .from(transactions)
    .where(and(isNull(transactions.categoryId), isNull(transactions.manualCategoryId)));

  if (uncategorized.length === 0) return [];

  const descriptions = uncategorized.map(t => t.description);

  // Extract patterns using multiple strategies
  const suggestions = new Map<string, Set<string>>();

  // Strategy 1: Extract merchant-like prefixes (first 2-3 words, common pattern)
  for (const desc of descriptions) {
    const prefix = extractMerchantPrefix(desc);
    if (prefix && prefix.length >= 3) {
      const pattern = escapeForRegex(prefix);
      if (!suggestions.has(pattern)) suggestions.set(pattern, new Set());
      suggestions.get(pattern)!.add(desc);
    }
  }

  // Strategy 2: Find common substrings across descriptions
  const commonSubstrings = findCommonSubstrings(descriptions, 5); // min length 5
  for (const substring of commonSubstrings) {
    const pattern = escapeForRegex(substring);
    if (!suggestions.has(pattern)) {
      const matches = descriptions.filter(d => d.toLowerCase().includes(substring.toLowerCase()));
      if (matches.length >= 2) {
        suggestions.set(pattern, new Set(matches));
      }
    }
  }

  // Strategy 3: Group by normalized description (replace numbers with \d+)
  const normalized = new Map<string, Set<string>>();
  for (const desc of descriptions) {
    const norm = normalizeDescription(desc);
    if (!normalized.has(norm)) normalized.set(norm, new Set());
    normalized.get(norm)!.add(desc);
  }

  for (const [norm, descs] of normalized) {
    if (descs.size >= 2) {
      // Convert normalized form to regex pattern
      const pattern = norm
        .replace(/\s+/g, '\\s+')
        .replace(/NUM/g, '\\d+');
      if (!suggestions.has(pattern)) {
        suggestions.set(pattern, descs);
      }
    }
  }

  // Convert to array and filter to patterns matching 2+ transactions
  const results: PatternSuggestion[] = [];
  for (const [pattern, matchedDescs] of suggestions) {
    if (matchedDescs.size >= 2) {
      // Verify pattern actually matches (sanity check)
      try {
        const regex = new RegExp(pattern, 'i');
        const verified = descriptions.filter(d => regex.test(d));
        if (verified.length >= 2) {
          results.push({
            pattern,
            matchCount: verified.length,
            sampleDescriptions: verified.slice(0, 3),
          });
        }
      } catch {
        // Invalid regex, skip
      }
    }
  }

  // Sort by match count descending, dedupe overlapping patterns
  results.sort((a, b) => b.matchCount - a.matchCount);
  return dedupeOverlappingPatterns(results);
}

/**
 * Extract merchant-like prefix from description.
 * Takes first 2-3 capitalized words or words before common separators.
 */
function extractMerchantPrefix(desc: string): string | null {
  // Remove leading transaction codes/dates
  const cleaned = desc.replace(/^[\d\s*#-]+/, '').trim();

  // Split on common separators
  const parts = cleaned.split(/[*#\-\/\\|]+/);
  if (parts.length > 1 && parts[0].trim().length >= 3) {
    return parts[0].trim();
  }

  // Take first 2-3 words if they look like a merchant name
  const words = cleaned.split(/\s+/);
  if (words.length >= 2) {
    const prefix = words.slice(0, Math.min(3, words.length)).join(' ');
    // Skip if it's mostly numbers or too short
    if (prefix.replace(/\d/g, '').length >= 3) {
      return prefix;
    }
  }

  return null;
}

/**
 * Escape special regex characters.
 */
function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalize description by replacing numbers with placeholder.
 */
function normalizeDescription(desc: string): string {
  return desc
    .replace(/\d+/g, 'NUM')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Find common substrings that appear in multiple descriptions.
 */
function findCommonSubstrings(descriptions: string[], minLength: number): string[] {
  const substringCounts = new Map<string, number>();

  for (const desc of descriptions) {
    const lowerDesc = desc.toLowerCase();
    const seen = new Set<string>();

    // Extract substrings of various lengths
    for (let len = minLength; len <= Math.min(30, lowerDesc.length); len++) {
      for (let i = 0; i <= lowerDesc.length - len; i++) {
        const sub = lowerDesc.substring(i, i + len);
        // Skip if mostly whitespace or numbers
        if (sub.replace(/[\s\d]/g, '').length < minLength - 1) continue;
        // Only count once per description
        if (!seen.has(sub)) {
          seen.add(sub);
          substringCounts.set(sub, (substringCounts.get(sub) || 0) + 1);
        }
      }
    }
  }

  // Filter to substrings appearing in 2+ descriptions
  const common: string[] = [];
  for (const [sub, count] of substringCounts) {
    if (count >= 2) {
      common.push(sub);
    }
  }

  // Sort by length descending (prefer longer matches)
  common.sort((a, b) => b.length - a.length);

  // Keep only non-overlapping substrings (longer ones take priority)
  const result: string[] = [];
  for (const sub of common) {
    const isSubstringOfExisting = result.some(r => r.includes(sub));
    if (!isSubstringOfExisting) {
      result.push(sub);
    }
    if (result.length >= 20) break; // Limit results
  }

  return result;
}

/**
 * Remove patterns that are subsets of other patterns with similar match counts.
 */
function dedupeOverlappingPatterns(patterns: PatternSuggestion[]): PatternSuggestion[] {
  const result: PatternSuggestion[] = [];

  for (const pattern of patterns) {
    // Check if this pattern's matches are a subset of an existing pattern
    const isDuplicate = result.some(existing => {
      // If match counts are similar and one pattern contains the other
      const countDiff = Math.abs(existing.matchCount - pattern.matchCount);
      const similarCounts = countDiff <= 1 || countDiff / existing.matchCount < 0.2;

      if (similarCounts) {
        // Check if patterns are related (one contains the other)
        const p1 = pattern.pattern.toLowerCase();
        const p2 = existing.pattern.toLowerCase();
        return p1.includes(p2) || p2.includes(p1);
      }
      return false;
    });

    if (!isDuplicate) {
      result.push(pattern);
    }

    if (result.length >= 10) break; // Limit suggestions
  }

  return result;
}
