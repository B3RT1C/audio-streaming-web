export interface Track {
  id: number;
  path: string;
  name: string;
  extension: string;
  contentHash?: string;
}

export const API_PATHS = {
  songs: '/song',
  songFile: '/song/file',
  syncStatus: '/sync/status',
} as const;
