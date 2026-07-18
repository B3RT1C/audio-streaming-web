export interface Track {
  id: number;
  path: string;
  name: string;
  extension: string;
  contentHash?: string;
}

export const API_PATHS = {
  audios: '/audios',
  syncStatus: '/sync/status',
} as const;
