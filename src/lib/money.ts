const UNITS = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 20) return UNITS[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + UNITS[n % 10] : ''}`;
}

function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  let s = '';
  if (h) s += `${UNITS[h]} Hundred`;
  if (r) s += `${h ? ' ' : ''}${twoDigits(r)}`;
  return s;
}

function indianWords(num: number): string {
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rest = num % 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(' ');
}

export function formatINR(paise: number, opts?: { showPaise?: boolean; sign?: boolean }): string {
  const showPaise = opts?.showPaise ?? false;
  const showSign = opts?.sign ?? false;
  const negative = paise < 0;
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / 100);
  const p = abs % 100;

  let formatted: string;
  if (showPaise && p > 0) {
    formatted = `₹${rupees.toLocaleString('en-IN')}.${String(p).padStart(2, '0')}`;
  } else {
    formatted = `₹${rupees.toLocaleString('en-IN')}`;
  }

  if (negative) return `-${formatted}`;
  if (showSign && paise > 0) return `+${formatted}`;
  return formatted;
}

export function parseRupeesToPaise(input: string): number {
  const cleaned = input.replace(/[₹,\s]/g, '').trim();
  const val = parseFloat(cleaned);
  if (isNaN(val)) throw new Error(`Cannot parse "${input}" as rupees`);
  return Math.round(val * 100);
}

export function addPaise(a: number, b: number): number {
  return a + b;
}

export function subPaise(a: number, b: number): number {
  return a - b;
}

export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  let words = indianWords(rupees);
  if (p > 0) {
    words += ` and ${indianWords(p)} Paise`;
  }
  return `${words} Only`;
}
