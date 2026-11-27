import { TestBed } from '@angular/core/testing';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  function create(): ThemeService {
    TestBed.configureTestingModule({});
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    root.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.removeItem(THEME_STORAGE_KEY);
    root.removeAttribute('data-theme');
  });

  it('should default to light when nothing is stored', () => {
    const service = create();
    service.init();

    expect(service.mode()).toBe('light');
    expect(root.getAttribute('data-theme')).toBe('light');
  });

  it('should restore a stored dark mode', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = create();
    service.init();

    expect(service.isDark()).toBeTrue();
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('should ignore invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    const service = create();
    service.init();

    expect(service.mode()).toBe('light');
  });

  it('should toggle, apply and persist the mode', () => {
    const service = create();
    service.init();

    service.toggle();
    expect(service.mode()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    service.toggle();
    expect(service.mode()).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});
