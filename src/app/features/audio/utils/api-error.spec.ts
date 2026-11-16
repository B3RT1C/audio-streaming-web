import { HttpErrorResponse } from '@angular/common/http';
import { toUserMessage } from './api-error';

describe('toUserMessage', () => {
  it('explains an invalid file and a file that is too large', () => {
    const invalid = new HttpErrorResponse({
      status: 400,
      error: { message: 'Invalid file', code: 'INVALID_FILE' },
    });
    const tooLarge = new HttpErrorResponse({ status: 413, error: { message: 'Maximum upload size exceeded' } });

    expect(toUserMessage('upload', invalid)).toBe('El archivo no es válido.');
    expect(toUserMessage('upload', tooLarge)).toBe('El archivo es demasiado grande (máximo 500 MB).');
  });

  it('reports a lost connection', () => {
    const offline = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });
    expect(toUserMessage('list', offline)).toBe('No hay conexión con el servidor.');
  });
});
