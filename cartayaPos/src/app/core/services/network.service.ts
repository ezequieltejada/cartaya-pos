import { Injectable, computed, inject, signal } from '@angular/core';
import { Platform } from '@ionic/angular';
import { Observable, fromEvent, merge } from 'rxjs';
import { distinctUntilChanged, map, startWith } from 'rxjs/operators';

/**
 * Network status information
 * Includes connection state, type, and timestamp
 */
export interface NetworkStatus {
  connected: boolean;
  connectionType: 'wifi' | '4g' | '3g' | 'none' | 'unknown';
  timestamp: string;
}

/**
 * Connection type enum for mapping Capacitor types
 * Mirrors @capacitor/network ConnectionType enum
 */
enum ConnectionType {
  Wifi = 'wifi',
  Cellular = 'cellular',
  None = 'none',
  Unknown = 'unknown',
}

/**
 * NetworkService
 * Provides real-time network state detection using Angular Signals
 * Integrates with browser navigator.onLine API and Capacitor Network plugin
 *
 * Usage in components:
 * ```typescript
 * export class MyComponent {
 *   private networkService = inject(NetworkService);
 *   isOnline = this.networkService.isOnline;
 *   networkQuality = this.networkService.networkQuality;
 * }
 * ```
 */
@Injectable({
  providedIn: 'root',
})
export class NetworkService {
  private platform = inject(Platform);

  // Writable signals (internal state)
  private readonly _isOnline = signal(this.getInitialOnlineState());
  private readonly _connectionType = signal<string>(ConnectionType.Unknown);

  // Public readonly signals for reactive updates
  readonly isOnline = this._isOnline.asReadonly();
  readonly connectionType = this._connectionType.asReadonly();

  // Computed signal for network quality indicator
  readonly networkQuality = computed(() => {
    if (!this._isOnline()) return 'offline';
    const type = this._connectionType();
    if (type === ConnectionType.Wifi) return 'excellent';
    if (type === ConnectionType.Cellular) return 'good';
    return 'poor';
  });

  constructor() {
    this.initializeNetworkListeners();
  }

  /**
   * Get initial online state from browser API
   * Safe fallback if navigator.onLine is not available
   */
  private getInitialOnlineState(): boolean {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  }

  /**
   * Initialize network state listeners
   * Uses browser APIs on web, Capacitor Network plugin on mobile
   */
  private initializeNetworkListeners(): void {
    if (this.platform.is('capacitor')) {
      // Use Capacitor Network plugin for mobile
      this.initializeCapacitorNetwork();
    } else {
      // Use browser APIs for web
      this.initializeBrowserNetwork();
    }
  }

  /**
   * Initialize Capacitor Network plugin (mobile)
   * Dynamically imports and initializes the plugin to avoid errors
   * in browser/testing environments where the plugin isn't available
   */
  private async initializeCapacitorNetwork(): Promise<void> {
    try {
      // Dynamically import to avoid build errors if @capacitor/network not installed
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { Network } = await import('@capacitor/network') as any;

      // Get initial network status
      const status = await Network.getStatus();
      this._isOnline.set(status.connected);
      this._connectionType.set(this.mapConnectionType(status.connectionType));

      // Listen for network status changes
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Network.addListener('networkStatusChange', (status: any) => {
        this._isOnline.set(status.connected);
        this._connectionType.set(this.mapConnectionType(status.connectionType));
      });
    } catch (error) {
      console.warn(
        'Capacitor Network plugin not available, falling back to browser API',
        error
      );
      this.initializeBrowserNetwork();
    }
  }

  /**
   * Initialize browser network event listeners (web)
   * Sets up listeners for online/offline events from the browser
   */
  private initializeBrowserNetwork(): void {
    // Initial state
    this._isOnline.set(navigator.onLine);
    this._connectionType.set(ConnectionType.Wifi); // Assume wifi for browser

    // Listen for online events
    window.addEventListener('online', () => {
      this._isOnline.set(true);
      this._connectionType.set(ConnectionType.Wifi);
    });

    // Listen for offline events
    window.addEventListener('offline', () => {
      this._isOnline.set(false);
      this._connectionType.set(ConnectionType.None);
    });
  }

  /**
   * Returns an Observable that emits on network state changes
   * Useful for triggering side effects in services using RxJS operators
   *
   * Example:
   * ```typescript
   * this.networkService.onNetworkChange()
   *   .pipe(filter(status => status.connected))
   *   .subscribe(status => this.syncData());
   * ```
   */
  onNetworkChange(): Observable<NetworkStatus> {
    if (this.platform.is('capacitor')) {
      return this.createCapacitorNetworkObservable();
    } else {
      return this.createBrowserNetworkObservable();
    }
  }

  /**
   * Create Observable from Capacitor Network plugin
   * Wraps the plugin's listener in an Observable
   */
  private createCapacitorNetworkObservable(): Observable<NetworkStatus> {
    return new Observable((observer) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let handler: any;

      (async () => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { Network } = await import('@capacitor/network') as any;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          handler = Network.addListener('networkStatusChange', (status: any) => {
            observer.next({
              connected: status.connected,
              connectionType: this.mapConnectionType(status.connectionType),
              timestamp: new Date().toISOString(),
            });
          });

          // Emit initial state
          const currentStatus = await Network.getStatus();
          observer.next({
            connected: currentStatus.connected,
            connectionType: this.mapConnectionType(currentStatus.connectionType),
            timestamp: new Date().toISOString(),
          });
        } catch (error) {
          console.warn('Failed to initialize Capacitor Network Observable', error);
          observer.next({
            connected: navigator.onLine,
            connectionType: navigator.onLine ? 'wifi' : 'none',
            timestamp: new Date().toISOString(),
          });
        }
      })();

      // Cleanup
      return () => {
        if (handler) {
          handler.remove();
        }
      };
    });
  }

  /**
   * Create Observable from browser network events
   * Uses merge of online/offline events with RxJS operators
   */
  private createBrowserNetworkObservable(): Observable<NetworkStatus> {
    return merge(
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).pipe(
      startWith(navigator.onLine),
      distinctUntilChanged(),
      map(
        (connected) => ({
          connected,
          connectionType: (connected ? 'wifi' : 'none') as
            | 'wifi'
            | '4g'
            | '3g'
            | 'none'
            | 'unknown',
          timestamp: new Date().toISOString(),
        })
      )
    );
  }

  /**
   * Map Capacitor connection type to simplified string
   * Abstracts Capacitor's ConnectionType enum to our simplified types
   */
  private mapConnectionType(type: string): 'wifi' | '4g' | '3g' | 'none' | 'unknown' {
    switch (type) {
      case ConnectionType.Wifi:
      case 'wifi':
        return 'wifi';
      case ConnectionType.Cellular:
      case 'cellular':
        return '4g'; // Simplified, could be 3G/4G/5G
      case ConnectionType.None:
      case 'none':
        return 'none';
      default:
        return 'unknown';
    }
  }

  /**
   * Check if currently online (for guards/interceptors)
   * Synchronous getter for current state
   */
  getIsOnline(): boolean {
    return this._isOnline();
  }

  /**
   * Get current connection type (for guards/interceptors)
   * Synchronous getter for current state
   */
  getConnectionType(): string {
    return this._connectionType();
  }

  /**
   * Manually trigger network status check
   * Useful for debugging or forced refresh
   */
  async checkNetworkStatus(): Promise<NetworkStatus> {
    if (this.platform.is('capacitor')) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { Network } = await import('@capacitor/network') as any;
        const status = await Network.getStatus();
        this._isOnline.set(status.connected);
        this._connectionType.set(this.mapConnectionType(status.connectionType));
        return {
          connected: status.connected,
          connectionType: this.mapConnectionType(status.connectionType),
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.warn('Failed to check network status via Capacitor', error);
        const connected = navigator.onLine;
        this._isOnline.set(connected);
        this._connectionType.set(connected ? 'wifi' : 'none');
        return {
          connected,
          connectionType: connected ? 'wifi' : 'none',
          timestamp: new Date().toISOString(),
        };
      }
    } else {
      const connected = navigator.onLine;
      this._isOnline.set(connected);
      this._connectionType.set(connected ? 'wifi' : 'none');
      return {
        connected,
        connectionType: connected ? 'wifi' : 'none',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
