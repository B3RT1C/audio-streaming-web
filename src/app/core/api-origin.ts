/** Page location fields used to build the default API origin. */
export interface LocationLike {
  protocol: string;
  hostname: string;
}

/**
 * Optional runtime override loaded from `/config.json`.
 * Leave `apiUrl` empty to use the page host on port 8080.
 */
export interface RuntimeConfigFile {
  apiUrl?: string | null;
}

export const DEFAULT_API_PORT = 8080;

export function defaultApiOrigin(locationLike: LocationLike): string {
  const protocol = locationLike.protocol || 'http:';
  const hostname = locationLike.hostname || 'localhost';
  return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
}

/** Resolves the API origin. A non-empty `apiUrl` wins; a trailing slash is stripped. */
export function resolveApiOrigin(
  file: RuntimeConfigFile | null | undefined,
  locationLike: LocationLike,
): string {
  const override = file?.apiUrl?.trim();
  if (override) {
    return override.replace(/\/+$/, '');
  }
  return defaultApiOrigin(locationLike);
}

export function currentLocation(): LocationLike {
  if (typeof location === 'undefined' || !location.hostname) {
    return { protocol: 'http:', hostname: 'localhost' };
  }
  return { protocol: location.protocol || 'http:', hostname: location.hostname };
}
