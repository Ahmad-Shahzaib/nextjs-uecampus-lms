// Uploads are disabled in the UI-only build. These exports exist to
// prevent import errors, but they intentionally throw to signal that
// backend functionality is not available.

export type DirectUploadProgress = {
  loaded: number;
  total?: number;
  percent: number;
};

export type DirectUploadResult = {
  fileIdentifier: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadId: string;
};

export async function directUploadFile(_file: File): Promise<DirectUploadResult> {
  throw new Error("Uploads disabled: backend removed in UI-only build");
}
