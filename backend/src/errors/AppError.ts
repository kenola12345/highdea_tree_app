import { ERROR_STATUS, type ErrorCode, type FieldError } from "@highdea/shared";

/** エラーコードごとの既定メッセージ（利用者向けの短い英文） */
const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  URL_NOT_ALLOWED: "This URL can't be used",
  USERNAME_RESERVED: "This username is reserved",
  VALIDATION_ERROR: "Some fields are invalid",
  INVALID_CREDENTIALS: "Email or password is incorrect",
  UNAUTHENTICATED: "Please log in",
  ALREADY_AUTHENTICATED: "You're already logged in",
  FORBIDDEN: "You don't have permission to do this",
  WRONG_PASSWORD: "The password is incorrect",
  CATEGORY_NOT_FOUND: "Category not found",
  NODE_NOT_FOUND: "Idea not found",
  PARENT_NOT_FOUND: "Parent idea not found",
  ROUTE_NOT_FOUND: "This API endpoint doesn't exist",
  TREE_NOT_FOUND: "Tree not found",
  UPLOAD_NOT_FOUND: "Image not found. Please upload it again",
  USER_NOT_FOUND: "User not found",
  CANNOT_DELETE_ROOT: "The center idea can't be deleted",
  CATEGORY_LIMIT_REACHED: "You can have up to 100 categories",
  CATEGORY_NAME_TAKEN: "You already have a category with this name",
  EMAIL_TAKEN: "This email is already registered",
  INVALID_MOVE: "An idea can't be moved there",
  NODE_LIMIT_REACHED: "This tree is full (2,000 ideas)",
  TREE_ALREADY_REMOVED: "This tree was already removed",
  TREE_NOT_IN_TRASH: "This tree isn't in the Trash",
  TREE_REMOVED: "An admin removed this tree, so it can't be made public",
  USERNAME_TAKEN: "This username is already taken",
  FILE_TOO_LARGE: "The file is larger than 5 MB",
  UNSUPPORTED_FILE_TYPE: "Only PNG, JPEG, WebP or GIF images are allowed",
  PREVIEW_UNAVAILABLE: "No preview available for this page",
  RATE_LIMITED: "Too many requests. Please try again later",
  INTERNAL_ERROR: "Something went wrong",
};

/**
 * 想定内の失敗を表す例外。サービス層で throw し、errorHandler が共通エラー形式に変換する。
 * HTTP ステータスはコードから決まるため、呼び出し側では指定しない。
 */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    readonly details?: FieldError[],
  ) {
    super(message);
    this.name = "AppError";
    this.status = ERROR_STATUS[code];
  }
}
