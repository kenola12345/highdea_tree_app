import { loginSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { useLogin } from "../../api/authMutations";
import { ApiError } from "../../api/client";
import { FormField, inputClassName } from "../../components/FormField";
import { useApiForm } from "../../lib/forms";

type LoginFormProps = { onSuccess: () => void };

/**
 * ログインフォーム（P-03）。メールとパスワードのどちらが違うかは表示しない
 * （サーバーも同じ 401 INVALID_CREDENTIALS を返す: manifests/users.md POST /api/auth/login）。
 */
export function LoginForm({ onSuccess }: LoginFormProps) {
  const [values, setValues] = useState({ email: "", password: "" });
  const form = useApiForm(loginSchema);
  const login = useLogin();

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const body = form.validate(values);
    if (!body) return;
    login.mutate(body, {
      onSuccess,
      onError: (err) => {
        if (err instanceof ApiError && err.code === "RATE_LIMITED") {
          // 15分に5回失敗すると一時的に止まる（manifests/users.md）
          form.setFormError("Too many attempts. Please wait a few minutes and try again.");
          return;
        }
        form.applyServerError(err);
      },
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="login-form">
      <FormField id="email" label="Email" error={form.fieldErrors.email}>
        {(props) => (
          <input
            {...props}
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={(e) => {
              setValues((v) => ({ ...v, email: e.target.value }));
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormField id="password" label="Password" error={form.fieldErrors.password}>
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="current-password"
            value={values.password}
            onChange={(e) => {
              setValues((v) => ({ ...v, password: e.target.value }));
            }}
            className={inputClassName}
          />
        )}
      </FormField>
      {form.formError && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
          data-testid="login-error"
        >
          {form.formError}
        </p>
      )}
      <button
        type="submit"
        disabled={login.isPending}
        data-testid="login-submit"
        className="bg-brand-700 hover:bg-brand-800 text-surface w-full rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {login.isPending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
