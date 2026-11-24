// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  apiUrl: 'https://cartaya-api-dev.tailbc95f3.ts.net', // Tailscale URL of the local backend
  sentry: {
    dsn: 'https://9876bd9f9b6d4dce8c006bbb1bf8db22@rustrak.ezetejada.com/4',
    environment: 'development',
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
