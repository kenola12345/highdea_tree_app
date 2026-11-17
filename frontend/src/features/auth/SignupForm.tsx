import { signupSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { useSignup } from "../../api/authMutations";
import { FormField, inputClassName } from "../../components/FormField";
import { useApiForm } from "../../lib/forms";

type SignupFormProps = { onSuccess: () => void };

// 重複・予約語のエラーは該当する入力欄の下に出す（manifests/users.md POST /api/auth/signup）
const FIELD_BY_CODE = {
  EMAIL_TAKEN: "email",
  USERNAME_TAKEN: "username",
  USERNAME_RESERVED: "username",
};

/** 新規登録フォーム（P-02）。送信前に共有スキーマで検証し、サーバーのエラーも各項目に表示する */
export function SignupForm({ onSuccess }: SignupFormProps) {
  const [values, setValues] = useState({ email: "", username: "", displayName: "", password: "" });
  const form = useApiForm(signupSchema);
  const signup = useSignup();

  function update(field: keyof typeof values) {
    return (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
    };
  }

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const body = form.validate(values);
    if (!body) return;
    signup.mutate(body, {
      onSuccess,
      onError: (err) => form.applyServerError(err, FIELD_BY_CODE),
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4" data-testid="signup-form">
      <FormField id="email" label="Email" error={form.fieldErrors.email}>
        {(props) => (
          <input
            {...props}
            type="email"
            autoComplete="email"
            value={values.email}
            onChange={update("email")}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormField
        id="username"
        label="Username"
        hint="3–30 characters: a-z, 0-9 and _. Your profile will be at /u/username."
        error={form.fieldErrors.username}
      >
        {(props) => (
          <input
            {...props}
            autoComplete="username"
            autoCapitalize="none"
            value={values.username}
            onChange={update("username")}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormField id="displayName" label="Display name" error={form.fieldErrors.displayName}>
        {(props) => (
          <input
            {...props}
            autoComplete="name"
            value={values.displayName}
            onChange={update("displayName")}
            className={inputClassName}
          />
        )}
      </FormField>
      <FormField
        id="password"
        label="Password"
        hint="8–72 characters."
        error={form.fieldErrors.password}
      >
        {(props) => (
          <input
            {...props}
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={update("password")}
            className={inputClassName}
          />
        )}
      </FormField>
      {form.formError && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {form.formError}
        </p>
      )}
      <button
        type="submit"
        disabled={signup.isPending}
        data-testid="signup-submit"
        className="bg-brand-700 hover:bg-brand-800 text-surface w-full rounded-full px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
      >
        {signup.isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
