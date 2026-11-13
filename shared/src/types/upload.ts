// アップロード画像のレスポンス型（manifests/nodes.md POST /api/uploads）。

export type UploadResponse = {
  id: string;
  /** 画像の公開URL（/uploads/<storageKey>） */
  url: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};
