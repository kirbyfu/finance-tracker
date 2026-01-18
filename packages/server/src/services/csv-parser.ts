import crypto from 'crypto';

export interface ColumnMapping {
  date: string | number;
  description: string | number;
  amount?: string | number;
  debit?: string | number;
  credit?: string | number;
  balance?: string | number;
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
  columnMapping: ColumnMapping,
  hasHeaderRow: boolean = true
): ParsedTransaction[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 1) return [];

  let headerIndex: Record<string, number> = {};
  let dataStartIndex = 0;

  if (hasHeaderRow) {
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]);
    headers.forEach((h, i) => {
      headerIndex[h.trim()] = i;
    });
    dataStartIndex = 1;
  }

  const getColumnIndex = (mapping: string | number): number => {
    if (typeof mapping === 'number') {
      return mapping - 1; // Convert 1-based to 0-based
    }
    return headerIndex[mapping] ?? -1;
  };

  const transactions: ParsedTransaction[] = [];

  for (let i = dataStartIndex; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const dateIdx = getColumnIndex(columnMapping.date);
    const descIdx = getColumnIndex(columnMapping.description);

    const dateStr = values[dateIdx]?.trim();
    const description = values[descIdx]?.trim();

    if (!dateStr || !description) continue;

    let amount: number;
    if (columnMapping.amount !== undefined) {
      const amountIdx = getColumnIndex(columnMapping.amount);
      amount = parseAmount(values[amountIdx]);
    } else if (columnMapping.debit !== undefined && columnMapping.credit !== undefined) {
      const debitIdx = getColumnIndex(columnMapping.debit);
      const creditIdx = getColumnIndex(columnMapping.credit);
      const debit = parseAmount(values[debitIdx]);
      const credit = parseAmount(values[creditIdx]);
      amount = credit - debit;
    } else {
      continue;
    }

    let balance: number | null = null;
    if (columnMapping.balance !== undefined) {
      const balanceIdx = getColumnIndex(columnMapping.balance);
      if (balanceIdx >= 0) {
        balance = parseAmount(values[balanceIdx]);
      }
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
