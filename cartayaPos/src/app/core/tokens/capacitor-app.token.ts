import { InjectionToken } from '@angular/core';
import { App } from '@capacitor/app';

/**
 * The Capacitor App plugin, injected so specs can provide a fake
 * (Capacitor plugin objects are proxies, which jasmine cannot spy on).
 */
export const CAPACITOR_APP = new InjectionToken<typeof App>('CAPACITOR_APP', {
  providedIn: 'root',
  factory: () => App,
});
