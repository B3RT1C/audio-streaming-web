/** Tag names as returned by the API: trimmed, empty entries dropped, order kept. */
export function normalizeTagNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const names: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'string') {
      continue;
    }
    const name = entry.trim().replace(/\s+/g, ' ');
    if (name) {
      names.push(name);
    }
  }
  return names;
}

export function sameTag(left: string, right: string): boolean {
  return left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();
}
