import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig)
  .then(() => registerServiceWorker())
  .catch((err) => console.error(err));

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }
  void navigator.serviceWorker.register('sw.js').catch(() => undefined);
}
