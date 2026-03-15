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
  balance: number | null;
}

export function parseCSV(
  csvContent: string,
  _sourceId: number,
  columnMapping: ColumnMapping,
  hasHeaderRow: boolean = true,
): ParsedTransaction[] {
  const lines = csvContent.trim().split("\n");
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
    if (typeof mapping === "number") {
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
    } else if (
      columnMapping.debit !== undefined &&
      columnMapping.credit !== undefined
    ) {
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

    transactions.push({
      date,
      amount,
      description,
      balance,
    });
  }

  return transactions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseAmount(value: string | undefined): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,\s]/g, "").trim();
  if (!cleaned) return 0;
  return parseFloat(cleaned) || 0;
}

function normalizeDate(dateStr: string): string {
  // Try to parse day/month/year format first (e.g., 15/01/2024 or 15-01-2024)
  const dmyMatch = dateStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    // If day > 12, it's definitely day/month/year format
    // If month > 12, it's month/day/year format (American)
    // Otherwise assume day/month/year (European)
    if (dayNum > 12 || (dayNum <= 12 && monthNum <= 12)) {
      // Treat as day/month/year — build string directly to avoid timezone shifts
      if (monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31) {
        return `${year}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      }
    }
  }

  // Fallback: if already ISO format (YYYY-MM-DD), return as-is
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return dateStr;

  // Last resort: parse with Date but extract local components to avoid timezone shift
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
