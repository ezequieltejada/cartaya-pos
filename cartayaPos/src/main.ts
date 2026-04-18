import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ErrorHandler, inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { PreloadAllModules, RouteReuseStrategy, Router, provideRouter, withPreloading } from '@angular/router';
import * as Sentry from '@sentry/capacitor';
import * as SentryAngular from '@sentry/angular';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { Storage } from '@ionic/storage-angular';
import { MissingTranslationHandler, provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { CustomMissingTranslationHandler } from './app/core/handlers/missing-translation.handler';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';
import { capacitorHttpInterceptor } from './app/core/interceptors/capacitor-http.interceptor';
import { languageHeaderInterceptor } from './app/core/interceptors/language-header.interceptor';
import { offlineInterceptor } from './app/core/interceptors/offline.interceptor';
import { environment } from './environments/environment';

Sentry.init(
  {
    dsn: environment.sentry.dsn,
    integrations: [SentryAngular.browserTracingIntegration()],
    tracesSampleRate: environment.sentry.tracesSampleRate,
  },
  SentryAngular.init
);

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(
      withInterceptors([
        languageHeaderInterceptor,
        offlineInterceptor,
        authInterceptor,
        capacitorHttpInterceptor,
      ])
    ),
    Storage,
    {
      provide: MissingTranslationHandler,
      useClass: CustomMissingTranslationHandler,
    },
    provideTranslateService({
      defaultLanguage: 'es',
      fallbackLang: 'en',
      missingTranslationHandler: {
        provide: MissingTranslationHandler,
        useClass: CustomMissingTranslationHandler,
      },
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }),
    }),
    {
      provide: ErrorHandler,
      useValue: SentryAngular.createErrorHandler(),
    },
    {
      provide: SentryAngular.TraceService,
      deps: [Router],
    },
    provideAppInitializer(() => {
      inject(SentryAngular.TraceService);
    }),
  ],
});
