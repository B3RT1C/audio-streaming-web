/** Generated art for tracks and playlists. Same seed always paints the same cover. */
export interface CoverArt {
  initials: string;
  background: string;
  wash: string;
}

export function coverArt(seed: string | null | undefined): CoverArt {
  const text = seed?.trim() || 'Música';
  const parts = text.split(/\s+/).filter(Boolean);
  const initials = (parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}` : text.slice(0, 2)).toUpperCase();
  let hash = 0;
  for (const char of text) {
    hash = (hash * 33 + char.charCodeAt(0)) >>> 0;
  }
  const hue = hash % 360;
  const second = (hue + 36 + (hash % 24)) % 360;
  return {
    initials,
    wash: `hsl(${hue} 48% 38%)`,
    background: `linear-gradient(145deg, hsl(${hue} 62% 46%), hsl(${second} 58% 28%))`,
  };
}
