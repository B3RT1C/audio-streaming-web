export interface ApiErrorBody {
  message?: string;
  code?: string;
}

export type ApiErrorCode =
  | 'FILE_REQUIRED'
  | 'INVALID_NAME'
  | 'INVALID_FILE'
  | 'FILE_TOO_LARGE'
  | 'NOT_FOUND'
  | 'STORAGE_ERROR'
  | 'INTERNAL'
  | 'NETWORK'
  | 'UNAVAILABLE'
  | 'PLAYBACK_ERROR';

export type ApiOperation =
  | 'list'
  | 'upload'
  | 'delete'
  | 'playback'
  | 'metadata'
  | 'playlist';
