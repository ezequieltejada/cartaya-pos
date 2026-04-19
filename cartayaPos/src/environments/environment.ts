// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'https://api-dev.cartaya.app', // Cloudflare Tunnel URL for development
  sentry: {
    dsn: 'https://f95c5f8fcb4fe592d54068c2b42ee3fc@o4509323360272384.ingest.us.sentry.io/4511242496245760',
    tracesSampleRate: 1.0,
  },
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/plugins/zone-error';  // Included with Angular CLI.
