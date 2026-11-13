import { ALLOWED_IMAGE_TYPES, type UploadResponse } from "@highdea/shared";
import { type ChangeEvent, useState } from "react";

import { ApiError } from "../../api/client";
import { uploadImage } from "../../api/uploads";

type ImageUploadFieldProps = {
  /** いま表示する画像（既存の画像、またはアップロード済みの新しい画像） */
  currentUrl: string | null;
  onUploaded: (upload: UploadResponse) => void;
  error?: string;
};

// エラーコードごとの案内（manifests/nodes.md SPA points「Image uploads」）
const MESSAGES: Partial<Record<string, string>> = {
  FILE_TOO_LARGE: "Max 5 MB",
  UNSUPPORTED_FILE_TYPE: "PNG, JPEG, WebP or GIF only",
  RATE_LIMITED: "Too many uploads. Please try again later.",
};

/** 画像のアップロード欄。進み具合を表示し、失敗理由をこの欄の下に出す */
export function ImageUploadField({ currentUrl, onUploaded, error }: ImageUploadFieldProps) {
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  function onChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    setProgress(0);
    uploadImage(file, setProgress)
      .then((upload) => {
        onUploaded(upload);
      })
      .catch((err: unknown) => {
        setUploadError(
          err instanceof ApiError ? (MESSAGES[err.code] ?? err.message) : "The upload failed.",
        );
      })
      .finally(() => {
        setProgress(null);
      });
  }

  const shown = uploadError ?? error;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-slate-800">Image</p>
      {currentUrl && (
        <img
          src={currentUrl}
          alt=""
          className="max-h-48 rounded-lg border border-slate-200 object-contain"
        />
      )}
      <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {currentUrl ? "Replace image" : "Choose an image"}
        <input
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          onChange={onChange}
          disabled={progress !== null}
          data-testid="image-input"
          className="sr-only"
        />
      </label>
      <p className="text-xs text-slate-500">PNG, JPEG, WebP or GIF, up to 5 MB.</p>
      {progress !== null && (
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={Math.round(progress * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Upload progress"
        >
          <div
            className="bg-brand-600 h-full transition-all"
            style={{ width: `${String(Math.round(progress * 100))}%` }}
          />
        </div>
      )}
      {shown && (
        <p className="text-xs text-red-700" data-testid="image-error">
          {shown}
        </p>
      )}
    </div>
  );
}
