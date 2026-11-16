import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, firstValueFrom, of, tap } from 'rxjs';
import { currentLocation, resolveApiOrigin, RuntimeConfigFile } from './api-origin';

@Injectable({
  providedIn: 'root',
})
export class RuntimeConfigService {
  private readonly origin = signal(resolveApiOrigin(null, currentLocation()));

  readonly apiOrigin = this.origin.asReadonly();

  apply(file: RuntimeConfigFile | null | undefined): void {
    this.origin.set(resolveApiOrigin(file, currentLocation()));
  }

  url(path: string): string {
    const suffix = path.startsWith('/') ? path : `/${path}`;
    return `${this.origin()}${suffix}`;
  }
}

/** Loads `config.json` from the deployed site before the first API call. */
export function loadRuntimeConfig(): Promise<void> {
  const http = inject(HttpClient);
  const config = inject(RuntimeConfigService);
  return firstValueFrom(
    http.get<RuntimeConfigFile>('config.json').pipe(
      tap((file) => config.apply(file)),
      catchError(() => {
        config.apply(null);
        return of(null);
      }),
    ),
  ).then(() => undefined);
}
