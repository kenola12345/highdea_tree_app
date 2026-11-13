import type { ReactNode } from "react";

/** 設定フォームの見出し付きの枠 */
export function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 p-4 md:p-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** フォーム全体のエラー表示 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  );
}

/** 保存ボタン */
export function SaveButton({
  pending,
  label = "Save",
  testId,
}: {
  pending: boolean;
  label?: string;
  testId?: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      data-testid={testId}
      className="bg-brand-600 hover:bg-brand-700 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

/** パスワード確認の誤りが続いたとき（15分に5回）の案内（manifests/users.md） */
export const TOO_MANY_PASSWORD_ATTEMPTS =
  "Too many wrong passwords. Please wait 15 minutes and try again.";
