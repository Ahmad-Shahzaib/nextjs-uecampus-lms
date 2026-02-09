// Chunked uploads disabled in UI-only build. Exported function throws
// to indicate uploads are not available.

export type ChunkUploadProgress = {
  uploadedChunks: number;
  totalChunks: number;
};

export type ChunkUploadResult = {
  fileIdentifier: string;
  filePath: string;
  mimeType: string;
  size: number;
  uploadId: string;
};

export async function chunkedUploadFile(_file: File): Promise<ChunkUploadResult> {
  throw new Error("Chunked uploads disabled: backend removed in UI-only build");
}
