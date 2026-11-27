import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { LoggerService } from './logger.service';

export type ThemeMode = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'cartaya.theme';

/**
 * Light/dark mode. Light is the default and the OS preference is ignored: the choice is stored
 * on the device and applied as `<html data-theme="...">`, which tokens.css reads.
 * localStorage (not Ionic Storage) because the theme must be known synchronously before first paint.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly log = inject(LoggerService).scope('theme');

  private readonly modeState = signal<ThemeMode>('light');
  readonly mode = this.modeState.asReadonly();
  readonly isDark = computed(() => this.modeState() === 'dark');

  /** Restores the saved mode (light when there is none) and applies it. Call once at app start. */
  init(): void {
    this.apply(this.readStored());
  }

  setMode(mode: ThemeMode): void {
    this.apply(mode);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      this.log.warn('could not persist theme', error);
    }
  }

  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  private apply(mode: ThemeMode): void {
    this.modeState.set(mode);
    this.document.documentElement.setAttribute('data-theme', mode);
    this.log.trace('theme applied', { mode });
  }

  private readStored(): ThemeMode {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  }
}
