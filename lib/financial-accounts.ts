export const DEFAULT_FINANCIAL_ACCOUNT_COLOR = '#2563EB';

export const FINANCIAL_ACCOUNT_COLORS = [
  { value: '#2563EB', label: 'Blue' },
  { value: '#4F46E5', label: 'Indigo' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#DB2777', label: 'Pink' },
  { value: '#E11D48', label: 'Rose' },
  { value: '#D97706', label: 'Amber' },
  { value: '#059669', label: 'Emerald' },
  { value: '#0891B2', label: 'Cyan' },
] as const;

export function financialAccountColor(value?: string) {
  return FINANCIAL_ACCOUNT_COLORS.some((option) => option.value === value)
    ? value!
    : DEFAULT_FINANCIAL_ACCOUNT_COLOR;
}
