import { type ApiErrorBody, UPLOAD_FIELD_NAME, type UploadResponse } from "@highdea/shared";

import { ApiError } from "./client";

/**
 * 画像をアップロードする（POST /api/uploads）。進み具合を表示するため fetch ではなく XMLHttpRequest を使う
 * （fetch は送信の進捗を取れない）。失敗時は他の API と同じ ApiError を投げる。
 */
export function uploadImage(
  file: File,
  onProgress: (fraction: number) => void,
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/uploads");
    xhr.withCredentials = true;
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => {
      const body = xhr.response as { data?: { upload: UploadResponse } } & Partial<ApiErrorBody>;
      if (xhr.status >= 200 && xhr.status < 300 && body.data) {
        resolve(body.data.upload);
        return;
      }
      reject(
        new ApiError(
          xhr.status,
          body.error?.code ?? "INTERNAL_ERROR",
          body.error?.message ?? "The upload failed. Please try again.",
          body.error?.details,
        ),
      );
    };
    xhr.onerror = () => {
      reject(
        new ApiError(
          0,
          "INTERNAL_ERROR",
          "The upload failed. Check your connection and try again.",
        ),
      );
    };
    const form = new FormData();
    form.append(UPLOAD_FIELD_NAME, file);
    xhr.send(form);
  });
}
