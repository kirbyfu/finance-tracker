import { describe, it, expect } from 'vitest';
import { parseCSV } from './csv-parser';

describe('csv-parser', () => {
  it('should parse CSV with headers using column names', () => {
    const csv = `Date,Description,Amount
2024-01-15,PURCHASE,-50.00`;
    const mapping = {
      date: 'Date',
      description: 'Description',
      amount: 'Amount',
    };

    const result = parseCSV(csv, 1, mapping, true);

    expect(result).toHaveLength(1);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].description).toBe('PURCHASE');
    expect(result[0].amount).toBe(-50);
  });

  it('should parse CSV without headers using 1-based column indices', () => {
    const csv = `2024-01-15,PURCHASE,-50.00
2024-01-16,DEPOSIT,1000.00`;
    const mapping = { date: 1, description: 2, amount: 3 };

    const result = parseCSV(csv, 1, mapping, false);

    expect(result).toHaveLength(2);
    expect(result[0].date).toBe('2024-01-15');
    expect(result[0].description).toBe('PURCHASE');
    expect(result[0].amount).toBe(-50);
    expect(result[1].date).toBe('2024-01-16');
    expect(result[1].description).toBe('DEPOSIT');
    expect(result[1].amount).toBe(1000);
  });

  it('should handle debit/credit columns without headers', () => {
    const csv = `2024-01-15,PURCHASE,50.00,
2024-01-16,DEPOSIT,,1000.00`;
    const mapping = { date: 1, description: 2, debit: 3, credit: 4 };

    const result = parseCSV(csv, 1, mapping, false);

    expect(result).toHaveLength(2);
    expect(result[0].amount).toBe(-50); // debit is negative
    expect(result[1].amount).toBe(1000); // credit is positive
  });
});
