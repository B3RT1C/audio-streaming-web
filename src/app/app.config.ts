import { ApplicationConfig, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';

import { routes } from './app.routes';
import { loadRuntimeConfig } from './core/runtime-config.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // XHR backend so uploads can report progress. The fetch backend cannot.
    provideHttpClient(),
    provideAppInitializer(loadRuntimeConfig),
  ],
};
