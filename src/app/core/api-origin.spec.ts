import { defaultApiOrigin, resolveApiOrigin } from './api-origin';

describe('resolveApiOrigin', () => {
  const page = { protocol: 'https:', hostname: 'mini.tailnet.ts.net' };

  it('uses the page protocol and hostname on port 8080', () => {
    expect(defaultApiOrigin(page)).toBe('https://mini.tailnet.ts.net:8080');
    expect(resolveApiOrigin(null, page)).toBe('https://mini.tailnet.ts.net:8080');
    expect(resolveApiOrigin({ apiUrl: '   ' }, page)).toBe('https://mini.tailnet.ts.net:8080');
  });

  it('lets config.json replace the origin and drops a trailing slash', () => {
    expect(resolveApiOrigin({ apiUrl: 'http://music.local:9090/' }, page)).toBe(
      'http://music.local:9090',
    );
  });
});
