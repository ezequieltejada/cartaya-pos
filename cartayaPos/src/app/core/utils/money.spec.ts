import { formatMoney, getCurrencyDecimals, localeForLanguage } from './money';

describe('money formatter', () => {
  describe('formatMoney', () => {
    it('formats EUR with two decimals', () => {
      expect(formatMoney(3.5, 'EUR')).toBe('€3.50');
    });

    it('formats USD with two decimals', () => {
      expect(formatMoney(3.5, 'USD')).toBe('$3.50');
    });

    it('uses the currency\'s own decimals: JPY has none', () => {
      const formatted = formatMoney(500, 'JPY');
      expect(formatted).toContain('500');
      expect(formatted).not.toContain('.');
    });

    it('rounds JPY amounts to whole units', () => {
      expect(formatMoney(3.5, 'JPY')).not.toContain('.');
    });

    it('does not mix currency symbols for the same code', () => {
      const catalog = formatMoney(3.5, 'JPY');
      const cart = formatMoney(7, 'JPY');
      const symbol = (value: string) => value.replace(/[\d.,\s]/g, '');
      expect(symbol(catalog)).toBe(symbol(cart));
      expect(catalog).not.toContain('€');
      expect(catalog).not.toContain('$');
    });

    it('shows an explicit sign when signed', () => {
      expect(formatMoney(1.5, 'EUR', 'en-US', { signed: true })).toBe('+€1.50');
      expect(formatMoney(-1.5, 'EUR', 'en-US', { signed: true })).toBe('-€1.50');
    });

    it('does not add a sign to zero when signed', () => {
      expect(formatMoney(0, 'EUR', 'en-US', { signed: true })).toBe('€0.00');
    });

    it('formats negative amounts', () => {
      expect(formatMoney(-2, 'EUR')).toBe('-€2.00');
    });

    it('uses the locale for grouping and symbol placement', () => {
      const formatted = formatMoney(3.5, 'EUR', 'es-ES');
      expect(formatted).toContain('3,50');
      expect(formatted).toContain('€');
    });

    it('falls back to EUR for an invalid currency code', () => {
      expect(formatMoney(1.5, 'NOT-A-CURRENCY')).toBe('€1.50');
    });

    it('falls back to EUR when the currency is missing', () => {
      expect(formatMoney(1.5, undefined)).toBe('€1.50');
    });

    it('treats null / NaN amounts as zero', () => {
      expect(formatMoney(null, 'EUR')).toBe('€0.00');
      expect(formatMoney(NaN, 'EUR')).toBe('€0.00');
    });
  });

  describe('getCurrencyDecimals', () => {
    it('returns 0 for JPY and 2 for EUR/USD', () => {
      expect(getCurrencyDecimals('JPY')).toBe(0);
      expect(getCurrencyDecimals('EUR')).toBe(2);
      expect(getCurrencyDecimals('USD')).toBe(2);
    });

    it('returns 3 for KWD', () => {
      expect(getCurrencyDecimals('KWD')).toBe(3);
    });

    it('defaults to 2 for unknown currencies', () => {
      expect(getCurrencyDecimals('???')).toBe(2);
    });
  });

  describe('localeForLanguage', () => {
    it('maps app languages to locales', () => {
      expect(localeForLanguage('en')).toBe('en-US');
      expect(localeForLanguage('es')).toBe('es-ES');
      expect(localeForLanguage('ca')).toBe('ca-ES');
      expect(localeForLanguage(undefined)).toBe('en-US');
    });
  });
});
