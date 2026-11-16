import { HttpErrorResponse } from '@angular/common/http';
import { ApiErrorBody, ApiErrorCode, ApiOperation } from '../models/api-error';

const CODE_MESSAGES: Record<string, string> = {
  FILE_REQUIRED: 'Falta el archivo de audio.',
  INVALID_NAME: 'El nombre no es válido.',
  INVALID_FILE: 'El archivo no es válido.',
  FILE_TOO_LARGE: 'El archivo es demasiado grande (máximo 500 MB).',
  INVALID_BODY: 'Los datos enviados no son válidos.',
  INVALID_ORDER: 'El orden de la lista no coincide con sus canciones.',
  RANGE_NOT_SATISFIABLE: 'No se puede reproducir ese punto del audio.',
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
  metadata: 'No se pudieron guardar los datos de la canción.',
  playlist: 'No se pudo actualizar la lista.',
};

const SIZE_CODES = new Set(['FILE_TOO_LARGE', 'PAYLOAD_TOO_LARGE', 'MAX_UPLOAD_SIZE']);

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
  if (isSizeError(err, body)) {
    return CODE_MESSAGES['FILE_TOO_LARGE'];
  }

  if (body?.code && CODE_MESSAGES[body.code]) {
    return CODE_MESSAGES[body.code];
  }

  if (err instanceof HttpErrorResponse) {
    if (err.status === 416) {
      return CODE_MESSAGES['RANGE_NOT_SATISFIABLE'];
    }
    if (err.status === 404) {
      return operation === 'playlist' ? 'No se encontró la lista.' : CODE_MESSAGES['NOT_FOUND'];
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

function isSizeError(err: unknown, body: ApiErrorBody | null): boolean {
  if (body?.code && SIZE_CODES.has(body.code)) {
    return true;
  }
  if (err instanceof HttpErrorResponse && err.status === 413) {
    return true;
  }
  const message = (body?.message ?? '').toLowerCase();
  return (
    message.includes('too large') ||
    message.includes('maximum upload') ||
    message.includes('size limit')
  );
}
