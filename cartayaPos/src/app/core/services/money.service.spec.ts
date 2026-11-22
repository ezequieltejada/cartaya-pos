import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { MoneyService } from './money.service';
import { SettingsService } from './settings.service';

describe('MoneyService', () => {
  let currency: ReturnType<typeof signal<string>>;
  let translate: { currentLang: string };
  let service: MoneyService;

  beforeEach(() => {
    currency = signal('EUR');
    translate = { currentLang: 'en' };
    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useValue: { currency } },
        { provide: TranslateService, useValue: translate },
      ],
    });
    service = TestBed.inject(MoneyService);
  });

  it('formats with the tenant currency', () => {
    expect(service.format(3.5)).toBe('€3.50');
  });

  it('follows tenant currency changes (JPY: no decimals)', () => {
    currency.set('JPY');
    const formatted = service.format(3.5);
    expect(formatted).not.toContain('€');
    expect(formatted).not.toContain('.');
  });

  it('uses the UI language for the locale', () => {
    translate.currentLang = 'es';
    expect(service.format(3.5)).toContain('3,50');
  });

  it('supports signed amounts', () => {
    expect(service.format(1, { signed: true })).toBe('+€1.00');
  });
});
