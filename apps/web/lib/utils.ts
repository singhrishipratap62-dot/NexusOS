import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatScore(value: number): string {
  return value.toFixed(2);
}

export function scoreVariant(value: number): 'good' | 'mid' | 'low' {
  if (value >= 0.75) return 'good';
  if (value >= 0.55) return 'mid';
  return 'low';
}
