import { describe, it, expect } from 'vitest';
import { cleanDescription } from './noise-phrases';
import type { NoisePhrase } from '../db/schema';

const makePhrase = (phrase: string, sourceId?: number | null): NoisePhrase => ({
  id: 1,
  phrase,
  sourceId: sourceId ?? null,
  createdAt: new Date(),
});

describe('noise-phrases', () => {
  describe('cleanDescription', () => {
    it('should remove single noise phrase', () => {
      const phrases = [makePhrase('payment by authority to')];
      const result = cleanDescription('PAYMENT BY AUTHORITY TO Anytime Fitness', phrases);
      expect(result).toBe('Anytime Fitness');
    });

    it('should remove multiple noise phrases', () => {
      const phrases = [
        makePhrase('payment by authority to'),
        makePhrase('direct debit'),
      ];
      const result = cleanDescription('DIRECT DEBIT PAYMENT BY AUTHORITY TO Store', phrases);
      expect(result).toBe('Store');
    });

    it('should be case-insensitive', () => {
      const phrases = [makePhrase('test phrase')];
      const result = cleanDescription('TEST PHRASE here', phrases);
      expect(result).toBe('here');
    });

    it('should collapse whitespace', () => {
      const phrases = [makePhrase('middle')];
      const result = cleanDescription('start MIDDLE end', phrases);
      expect(result).toBe('start end');
    });

    it('should handle empty phrases array', () => {
      const result = cleanDescription('Original Text', []);
      expect(result).toBe('Original Text');
    });

    it('should handle phrases not in description', () => {
      const phrases = [makePhrase('not present')];
      const result = cleanDescription('Some description', phrases);
      expect(result).toBe('Some description');
    });

    it('should handle special regex characters in phrases', () => {
      const phrases = [makePhrase('test (123)')];
      const result = cleanDescription('prefix TEST (123) suffix', phrases);
      expect(result).toBe('prefix suffix');
    });

    it('should remove multiple occurrences', () => {
      const phrases = [makePhrase('ref')];
      const result = cleanDescription('REF 123 REF 456 REF', phrases);
      expect(result).toBe('123 456');
    });
  });
});
