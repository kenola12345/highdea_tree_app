import { type MeResponse, updateAccountSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { ApiError } from "../../api/client";
import { useUpdateAccount } from "../../api/users";
import { FormField, inputClassName } from "../../components/FormField";
import { useToast } from "../../components/Toast";
import { useApiForm } from "../../lib/forms";
import { FormError, SaveButton, SettingsSection, TOO_MANY_PASSWORD_ATTEMPTS } from "./formParts";

const FIELD_BY_CODE = {
  WRONG_PASSWORD: "currentPassword",
  EMAIL_TAKEN: "email",
  USERNAME_TAKEN: "username",
  USERNAME_RESERVED: "username",
};

/** メール・ユーザー名の変更。変えた項目だけを送り、本人確認に現在のパスワードを求める（manifests/users.md） */
export function ChangeEmailUsernameForm({ user }: { user: MeResponse }) {
  const [email, setEmail] = useState(user.email);
  const [username, setUsername] = useState(user.username);
  const [currentPassword, setCurrentPassword] = useState("");
  const form = useApiForm(updateAccountSchema);
  const update = useUpdateAccount();
  const toast = useToast();

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const changes = {
      ...(email.trim().toLowerCase() !== user.email ? { email } : {}),
      ...(username.toLowerCase() !== user.username ? { username } : {}),
    };
    if (Object.keys(changes).length === 0) {
      form.setFormError("Change your email or username first.");
      return;
    }
    const body = form.validate({ ...changes, currentPassword });
    if (!body) return;
    update.mutate(body, {
      onSuccess: (updated) => {
        setEmail(updated.email);
        setUsername(updated.username);
        setCurrentPassword("");
        toast("Account updated", "success");
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === "RATE_LIMITED")
          form.setFormError(TOO_MANY_PASSWORD_ATTEMPTS);
        else form.applyServerError(err, FIELD_BY_CODE);
      },
    });
  }

  return (
    <SettingsSection title="Email and username">
      <form
        onSubmit={onSubmit}
        noValidate
        className="max-w-md space-y-4"
        data-testid="account-form"
      >
        <FormField id="account-email" label="Email" error={form.fieldErrors.email}>
          {(props) => (
            <input
              {...props}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              className={inputClassName}
            />
          )}
        </FormField>
        <FormField
          id="account-username"
          label="Username"
          hint="Changing it frees your old username right away: old /u/ links stop working and someone else can take it."
          error={form.fieldErrors.username}
        >
          {(props) => (
            <input
              {...props}
              autoCapitalize="none"
              autoComplete="username"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
              }}
              className={inputClassName}
            />
          )}
        </FormField>
        <FormField
          id="account-currentPassword"
          label="Current password"
          error={form.fieldErrors.currentPassword}
        >
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
              }}
              className={inputClassName}
            />
          )}
        </FormField>
        <FormError message={form.formError} />
        <SaveButton pending={update.isPending} label="Save changes" testId="account-save" />
      </form>
    </SettingsSection>
  );
}
