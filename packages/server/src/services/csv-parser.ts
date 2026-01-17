import crypto from 'crypto';

export interface ColumnMapping {
  date: string;
  description: string;
  amount?: string;
  debit?: string;
  credit?: string;
  balance?: string;
}

export interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  normalizedDescription: string;
  balance: number | null;
  hash: string;
}

export function parseCSV(
  csvContent: string,
  sourceId: number,
  columnMapping: ColumnMapping
): ParsedTransaction[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]);
  const headerIndex: Record<string, number> = {};
  headers.forEach((h, i) => {
    headerIndex[h.trim()] = i;
  });

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const dateStr = values[headerIndex[columnMapping.date]]?.trim();
    const description = values[headerIndex[columnMapping.description]]?.trim();

    if (!dateStr || !description) continue;

    let amount: number;
    if (columnMapping.amount) {
      amount = parseAmount(values[headerIndex[columnMapping.amount]]);
    } else if (columnMapping.debit && columnMapping.credit) {
      const debit = parseAmount(values[headerIndex[columnMapping.debit]]);
      const credit = parseAmount(values[headerIndex[columnMapping.credit]]);
      amount = credit - debit;
    } else {
      continue;
    }

    let balance: number | null = null;
    if (columnMapping.balance && headerIndex[columnMapping.balance] !== undefined) {
      balance = parseAmount(values[headerIndex[columnMapping.balance]]);
    }

    const date = normalizeDate(dateStr);
    const normalizedDescription = description.toLowerCase().trim();
    const hash = generateHash(sourceId, date, amount, normalizedDescription);

    transactions.push({
      date,
      amount,
      description,
      normalizedDescription,
      balance,
      hash,
    });
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s]/g, '').trim();
  if (!cleaned) return 0;
  return parseFloat(cleaned) || 0;
}

function normalizeDate(dateStr: string): string {
  // Try common formats and convert to YYYY-MM-DD
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toISOString().split('T')[0];
}

function generateHash(sourceId: number, date: string, amount: number, normalizedDesc: string): string {
  const str = `${sourceId}|${date}|${amount}|${normalizedDesc}`;
  return crypto.createHash('sha256').update(str).digest('hex').substring(0, 32);
}
