import { MAX_UPLOAD_BYTES, validateUploadFile } from './upload-rules';

describe('validateUploadFile', () => {
  it('accepts an audio file up to 500 MB', () => {
    expect(validateUploadFile(file('tema.mp3', 1024, 'audio/mpeg'))).toBeNull();
    expect(validateUploadFile(file('tema.m4a', 1024, ''))).toBeNull();
    expect(validateUploadFile(file('tema.flac', MAX_UPLOAD_BYTES, ''))).toBeNull();
  });

  it('rejects an empty file, a non-audio file and a file over the limit', () => {
    expect(validateUploadFile(file('vacio.mp3', 0, 'audio/mpeg'))).toBe(
      'El archivo está vacío o no es válido.',
    );
    expect(validateUploadFile(file('notas.txt', 20, 'text/plain'))).toBe(
      'El archivo no es un audio válido.',
    );
    expect(validateUploadFile(file('largo.mp3', MAX_UPLOAD_BYTES + 1, 'audio/mpeg'))).toBe(
      'El archivo es demasiado grande (máximo 500 MB).',
    );
  });
});

function file(name: string, size: number, type: string): File {
  return { name, size, type } as File;
}
