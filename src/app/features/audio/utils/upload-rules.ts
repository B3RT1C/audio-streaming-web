/** ~500 MB, matching the 0.2 upload ceiling. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

const ALLOWED_EXTENSIONS = new Set([
  'mp3',
  'mpeg',
  'm4a',
  'mp4',
  'aac',
  'wav',
  'flac',
  'ogg',
  'oga',
  'opus',
  'webm',
]);

export const UPLOAD_ACCEPT =
  'audio/*,.mp3,.m4a,.mp4,.aac,.wav,.flac,.ogg,.opus,.webm';

/** Returns a Spanish message when the file cannot be uploaded, or null when it can. */
export function validateUploadFile(file: File, maxBytes = MAX_UPLOAD_BYTES): string | null {
  if (!file || file.size <= 0) {
    return 'El archivo está vacío o no es válido.';
  }

  const extension = fileExtension(file.name);
  const mime = (file.type || '').toLowerCase();
  const allowed = mime.startsWith('audio/') || ALLOWED_EXTENSIONS.has(extension);
  if (!allowed) {
    return 'El archivo no es un audio válido.';
  }

  if (file.size > maxBytes) {
    return 'El archivo es demasiado grande (máximo 500 MB).';
  }

  return null;
}

function fileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return '';
  }
  return filename.slice(lastDot + 1).toLowerCase();
}
