export interface UploadDraft {
  file: File;
  /** Catalog display name (without extension). More fields can be added later. */
  name: string;
}

export function createUploadDraft(file: File): UploadDraft {
  return {
    file,
    name: stripExtension(file.name),
  };
}

function stripExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0) {
    return filename;
  }
  return filename.slice(0, lastDot);
}
