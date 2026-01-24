import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, transactions, categories, sources, noisePhrases } from '../db';
import { getSuggestions } from './pattern-suggester';
import { sql } from 'drizzle-orm';

describe('PatternSuggesterService', () => {
  let sourceId: number;
  let categoryIds: number[] = [];
  let transactionIds: number[] = [];

  beforeEach(async () => {
    // Clean up first
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM noise_phrases`);
    await db.run(sql`DELETE FROM categories`);
    await db.run(sql`DELETE FROM sources`);

    // Create test source
    const [source] = await db
      .insert(sources)
      .values({
        name: 'Test Bank',
        type: 'bank',
        columnMapping: JSON.stringify({ date: 'Date', description: 'Description', amount: 'Amount' }),
      })
      .returning();
    sourceId = source.id;

    // Create test categories
    const cats = await db
      .insert(categories)
      .values([
        { name: 'Groceries', color: '#00ff00' },
        { name: 'Transport', color: '#0000ff' },
        { name: 'Entertainment', color: '#ff0000' },
        { name: 'Utilities', color: '#ffff00' },
      ])
      .returning();
    categoryIds = cats.map((c) => c.id);
  });

  afterEach(async () => {
    // Clean up in dependency order
    await db.run(sql`DELETE FROM transactions`);
    await db.run(sql`DELETE FROM noise_phrases`);
    await db.run(sql`DELETE FROM categories`);
    await db.run(sql`DELETE FROM sources`);
    transactionIds = [];
    categoryIds = [];
  });

  async function insertTransaction(
    description: string,
    categoryId?: number,
    cleanedDescription?: string
  ) {
    const [tx] = await db
      .insert(transactions)
      .values({
        sourceId,
        date: '2024-01-15',
        description,
        cleanedDescription: cleanedDescription ?? description,
        amount: -10.0,
        categoryId: categoryId ?? null,
      })
      .returning();
    transactionIds.push(tx.id);
    return tx;
  }

  describe('getSuggestions', () => {
    it('returns empty when no transactions', async () => {
      const result = await getSuggestions();
      expect(result.patterns).toEqual([]);
      expect(result.detectedNoise).toEqual([]);
    });

    it('extracts n-grams with 2+ matches for a single transaction', async () => {
      // Insert transactions with common n-gram "anytime fitness"
      await insertTransaction('anytime fitness melbourne');
      await insertTransaction('anytime fitness sydney');
      const target = await insertTransaction('anytime fitness brisbane');

      const result = await getSuggestions(target.id);

      expect(result.patterns.length).toBeGreaterThan(0);
      // Should find "anytime fitness" as a pattern
      const anytimeFitnessPattern = result.patterns.find(
        (p) => p.pattern.toLowerCase().includes('anytime') && p.pattern.toLowerCase().includes('fitness')
      );
      expect(anytimeFitnessPattern).toBeDefined();

      // Should have at least 3 matches total (uncategorized + categorized)
      const totalMatches =
        (anytimeFitnessPattern?.uncategorizedCount ?? 0) + (anytimeFitnessPattern?.categorizedCount ?? 0);
      expect(totalMatches).toBeGreaterThanOrEqual(3);
    });

    it('sorts patterns by uncategorized count descending', async () => {
      // "common" appears in 4 uncategorized, "rare" appears in 2 uncategorized
      await insertTransaction('common phrase here');
      await insertTransaction('common phrase there');
      await insertTransaction('common phrase everywhere');
      await insertTransaction('common phrase anywhere');
      await insertTransaction('rare thing');
      const target = await insertTransaction('rare thing common phrase');

      const result = await getSuggestions(target.id);

      expect(result.patterns.length).toBeGreaterThanOrEqual(2);
      // First pattern should have more uncategorized matches than later ones
      for (let i = 1; i < result.patterns.length; i++) {
        expect(result.patterns[i - 1].uncategorizedCount).toBeGreaterThanOrEqual(
          result.patterns[i].uncategorizedCount
        );
      }
    });

    it('dedupes overlapping patterns (keeps longer/higher-count ones)', async () => {
      // "anytime fitness" appears 3 times, "anytime" appears 3 times
      // After sorting by count (same), longer pattern "anytime fitness" should be kept
      // and "anytime" (which is contained in "anytime fitness") should be deduped
      await insertTransaction('anytime fitness one');
      await insertTransaction('anytime fitness two');
      const target = await insertTransaction('anytime fitness three');

      const result = await getSuggestions(target.id);

      // Check we have patterns
      expect(result.patterns.length).toBeGreaterThan(0);

      // The result should include "anytime fitness" (multi-word)
      const hasAnytimeFitness = result.patterns.some(
        (p) => p.pattern.includes('anytime') && p.pattern.includes('fitness')
      );
      expect(hasAnytimeFitness).toBe(true);
    });

    it('separates uncategorized and categorized match counts', async () => {
      // Create 2 categorized + 3 uncategorized transactions with same pattern
      await insertTransaction('amazon purchase one', categoryIds[0]);
      await insertTransaction('amazon purchase two', categoryIds[1]);
      await insertTransaction('amazon purchase three');
      await insertTransaction('amazon purchase four');
      const target = await insertTransaction('amazon purchase five');

      const result = await getSuggestions(target.id);

      // Find the amazon pattern
      const amazonPattern = result.patterns.find((p) => p.pattern.toLowerCase().includes('amazon'));
      expect(amazonPattern).toBeDefined();
      expect(amazonPattern!.uncategorizedCount).toBe(3);
      expect(amazonPattern!.categorizedCount).toBe(2);
    });

    it('detects noise phrases appearing in 3+ categories', async () => {
      // "PAYMENT BY AUTHORITY" appears across multiple categories
      await insertTransaction('PAYMENT BY AUTHORITY TO Store1', categoryIds[0]);
      await insertTransaction('PAYMENT BY AUTHORITY TO Store2', categoryIds[1]);
      await insertTransaction('PAYMENT BY AUTHORITY TO Store3', categoryIds[2]);
      const target = await insertTransaction('PAYMENT BY AUTHORITY TO Store4');

      const result = await getSuggestions(target.id);

      // Should detect noise
      expect(result.detectedNoise.length).toBeGreaterThan(0);
      // "payment by authority" should be detected as noise
      const hasPaymentNoise = result.detectedNoise.some(
        (n) => n.phrase.includes('payment')
      );
      expect(hasPaymentNoise).toBe(true);
    });

    it('returns top 20 patterns', async () => {
      // Create many patterns
      for (let i = 0; i < 30; i++) {
        await insertTransaction(`Unique${i} pattern${i} thing`);
        await insertTransaction(`Unique${i} pattern${i} other`);
      }
      const target = await insertTransaction(
        'Unique0 pattern0 Unique1 pattern1 Unique2 pattern2 Unique3 pattern3 Unique4 pattern4 ' +
          'Unique5 pattern5 Unique6 pattern6 Unique7 pattern7 Unique8 pattern8 Unique9 pattern9 ' +
          'Unique10 pattern10 Unique11 pattern11 Unique12 pattern12 Unique13 pattern13 Unique14 pattern14 ' +
          'Unique15 pattern15 Unique16 pattern16 Unique17 pattern17 Unique18 pattern18 Unique19 pattern19 ' +
          'Unique20 pattern20 Unique21 pattern21 Unique22 pattern22 Unique23 pattern23 Unique24 pattern24'
      );

      const result = await getSuggestions(target.id);

      expect(result.patterns.length).toBeLessThanOrEqual(20);
    });

    it('generates proper regex patterns with word boundaries', async () => {
      // Multi-word pattern should have \s+ between words
      await insertTransaction('anytime fitness one');
      await insertTransaction('anytime fitness two');
      const target = await insertTransaction('anytime fitness three');

      const result = await getSuggestions(target.id);

      // Find the multi-word "anytime fitness" pattern
      const pattern = result.patterns.find(
        (p) => p.pattern.includes('anytime') && p.pattern.includes('fitness')
      );
      expect(pattern).toBeDefined();
      // Should have word boundaries
      expect(pattern!.pattern).toContain('\\b');
      // Multi-word patterns should have flexible whitespace
      expect(pattern!.pattern).toContain('\\s+');
    });
  });

});
