import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, ApiErrorCode, ApiOperation } from '../models/api-error';

const CODE_MESSAGES: Record<string, string> = {
  FILE_REQUIRED: 'Falta el archivo de audio.',
  INVALID_NAME: 'El nombre no es válido.',
  INVALID_FILE: 'El archivo no es válido.',
  NOT_FOUND: 'No se encontró la canción.',
  STORAGE_ERROR: 'Error al guardar el archivo.',
  INTERNAL: 'Algo salió mal. Inténtalo de nuevo.',
  NETWORK: 'No hay conexión con el servidor.',
  UNAVAILABLE: 'No se pudo cargar la biblioteca. Comprueba que el backend esté en marcha.',
  PLAYBACK_ERROR: 'No se pudo reproducir esta canción.',
};

const OPERATION_FALLBACKS: Record<ApiOperation, string> = {
  list: CODE_MESSAGES['UNAVAILABLE'],
  upload: 'No se pudo subir la canción.',
  delete: 'No se pudo eliminar la canción.',
  playback: CODE_MESSAGES['PLAYBACK_ERROR'],
};

export function extractApiError(err: unknown): ApiErrorBody | null {
  if (!(err instanceof HttpErrorResponse)) {
    return null;
  }

  const payload = err.error;
  if (!payload) {
    return null;
  }

  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload) as ApiErrorBody;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof payload === 'object') {
    return payload as ApiErrorBody;
  }

  return null;
}

export function toUserMessage(operation: ApiOperation, err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 0) {
    return CODE_MESSAGES['NETWORK'];
  }

  const body = extractApiError(err);
  if (body?.code && CODE_MESSAGES[body.code]) {
    return CODE_MESSAGES[body.code];
  }

  if (err instanceof HttpErrorResponse) {
    if (err.status === 404) {
      return CODE_MESSAGES['NOT_FOUND'];
    }
    if (err.status >= 500) {
      return CODE_MESSAGES['INTERNAL'];
    }
  }

  return OPERATION_FALLBACKS[operation];
}

export function playbackErrorMessage(): string {
  return CODE_MESSAGES['PLAYBACK_ERROR'];
}

export function codeMessage(code: ApiErrorCode): string {
  return CODE_MESSAGES[code];
}
