import { HttpErrorResponse } from '@angular/common/http';
import { toUserMessage } from './api-error';

describe('toUserMessage', () => {
  it('explains an invalid file and a file that is too large', () => {
    const invalid = new HttpErrorResponse({
      status: 400,
      error: { message: 'Invalid file', code: 'INVALID_FILE' },
    });
    const tooLarge = new HttpErrorResponse({
      status: 413,
      error: { message: 'File exceeds the maximum upload size of 500MB', code: 'FILE_TOO_LARGE' },
    });

    expect(toUserMessage('upload', invalid)).toBe('El archivo no es válido.');
    expect(toUserMessage('upload', tooLarge)).toBe('El archivo es demasiado grande (máximo 500 MB).');
  });

  it('explains an invalid playlist order and a range the server cannot satisfy', () => {
    const order = new HttpErrorResponse({
      status: 400,
      error: { message: 'The audioIds list must contain exactly the tracks in the playlist', code: 'INVALID_ORDER' },
    });
    const range = new HttpErrorResponse({
      status: 416,
      error: { message: 'Range not satisfiable', code: 'RANGE_NOT_SATISFIABLE' },
    });

    expect(toUserMessage('playlist', order)).toBe('El orden de la lista no coincide con sus canciones.');
    expect(toUserMessage('playback', range)).toBe('No se puede reproducir ese punto del audio.');
  });

  it('reports a lost connection', () => {
    const offline = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    expect(toUserMessage('list', offline)).toBe('No hay conexión con el servidor.');
  });
});
