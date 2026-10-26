export function financialYearOf(dateStr: string): { startYear: number; endYear: number; label: string } {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  const startYear = m >= 3 ? y : y - 1;
  const endYear = startYear + 1;
  return {
    startYear,
    endYear,
    label: `FY ${startYear}-${String(endYear).slice(2)}`,
  };
}

export function taxYearLabel(dateStr: string): string {
  return financialYearOf(dateStr).label;
}

export function addMonthsStr(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

export function addQuartersStr(dateStr: string, quarters: number): string {
  return addMonthsStr(dateStr, quarters * 3);
}

export function addYearsStr(dateStr: string, years: number): string {
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateLong(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(fromStr).getTime();
  const to = new Date(toStr).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isAfter(a: string, b: string): boolean {
  return a > b;
}

export function isSameOrBefore(a: string, b: string): boolean {
  return a <= b;
}

export function isSameOrAfter(a: string, b: string): boolean {
  return a >= b;
}
