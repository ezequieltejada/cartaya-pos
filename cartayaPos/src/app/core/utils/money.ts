/**
 * Money formatting
 * Single formatter used by every screen so amounts are always rendered with
 * the same currency and the currency's own number of decimals (JPY: 0, EUR: 2).
 */

export const DEFAULT_CURRENCY = 'EUR';

export interface FormatMoneyOptions {
  /** Prefix positive amounts with "+" (used for modifier price deltas). */
  signed?: boolean;
}

/** Maps app language codes to the locale used for number formatting. */
export function localeForLanguage(language?: string | null): string {
  switch (language) {
    case 'es':
      return 'es-ES';
    case 'ca':
      return 'ca-ES';
    default:
      return 'en-US';
  }
}

/**
 * Number of decimals used by a currency (ISO 4217), e.g. 0 for JPY, 2 for EUR.
 * Falls back to 2 when the currency code is not recognised.
 */
export function getCurrencyDecimals(currency: string): number {
  try {
    return (
      new Intl.NumberFormat('en-US', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? 2
    );
  } catch {
    return 2;
  }
}

/**
 * Format an amount as currency using the currency's own decimals.
 * Never throws: an invalid currency code falls back to DEFAULT_CURRENCY.
 */
export function formatMoney(
  amount: number | null | undefined,
  currency: string | null | undefined,
  locale = 'en-US',
  options: FormatMoneyOptions = {}
): string {
  const value = Number.isFinite(amount) ? (amount as number) : 0;
  const code = currency || DEFAULT_CURRENCY;
  // signDisplay is not in older TS lib typings
  const signDisplay = options.signed ? 'exceptZero' : 'auto';

  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, signDisplay } as Intl.NumberFormatOptions).format(value);
  } catch {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: DEFAULT_CURRENCY,
      signDisplay,
    } as Intl.NumberFormatOptions).format(value);
  }
}
