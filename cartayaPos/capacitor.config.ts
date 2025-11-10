import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.cartaya.pos',
  appName: 'CartaYa Pos',
  webDir: 'www',
  ios: {
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;
