import { TestScheduler } from 'rxjs/testing';
import { debouncedSearch } from './search-query';

describe('debouncedSearch', () => {
  let scheduler: TestScheduler;

  beforeEach(() => {
    scheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('trims, waits and ignores a repeated term', () => {
    scheduler.run(({ cold, expectObservable }) => {
      const terms = cold('a 299ms b 400ms c', { a: '  luna', b: 'luna ', c: 'azul' });
      const result = debouncedSearch(terms, 300, scheduler);
      expectObservable(result).toBe('600ms a 400ms b', { a: 'luna', b: 'azul' });
    });
  });
});
