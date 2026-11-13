import { changePasswordSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { ApiError } from "../../api/client";
import { useChangePassword } from "../../api/users";
import { FormField, inputClassName } from "../../components/FormField";
import { useToast } from "../../components/Toast";
import { useApiForm } from "../../lib/forms";
import { FormError, SaveButton, SettingsSection, TOO_MANY_PASSWORD_ATTEMPTS } from "./formParts";

/** パスワード変更。新しいパスワードは 8〜72文字で、現在のものと違う必要がある */
export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const form = useApiForm(changePasswordSchema);
  const change = useChangePassword();
  const toast = useToast();

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    const body = form.validate({ currentPassword, newPassword });
    if (!body) return;
    change.mutate(body, {
      onSuccess: () => {
        setCurrentPassword("");
        setNewPassword("");
        toast("Password changed", "success");
      },
      onError: (err) => {
        if (err instanceof ApiError && err.code === "RATE_LIMITED")
          form.setFormError(TOO_MANY_PASSWORD_ATTEMPTS);
        else form.applyServerError(err, { WRONG_PASSWORD: "currentPassword" });
      },
    });
  }

  return (
    <SettingsSection title="Password" description="You'll stay logged in on this browser.">
      <form
        onSubmit={onSubmit}
        noValidate
        className="max-w-md space-y-4"
        data-testid="password-form"
      >
        <FormField
          id="password-current"
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
        <FormField
          id="password-new"
          label="New password"
          hint="8–72 characters."
          error={form.fieldErrors.newPassword}
        >
          {(props) => (
            <input
              {...props}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
              }}
              className={inputClassName}
            />
          )}
        </FormField>
        <FormError message={form.formError} />
        <SaveButton pending={change.isPending} label="Change password" testId="password-save" />
      </form>
    </SettingsSection>
  );
}
