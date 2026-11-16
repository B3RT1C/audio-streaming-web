import { Observable, SchedulerLike } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

export const SEARCH_DEBOUNCE_MS = 300;

export function debouncedSearch(
  terms: Observable<string>,
  debounceMs = SEARCH_DEBOUNCE_MS,
  scheduler?: SchedulerLike,
): Observable<string> {
  return terms.pipe(
    map((term) => term.trim()),
    debounceTime(debounceMs, scheduler),
    distinctUntilChanged(),
  );
}
