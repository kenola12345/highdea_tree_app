import { type MeResponse, updateProfileSchema } from "@highdea/shared";
import { type SubmitEvent, useState } from "react";

import { useUpdateProfile } from "../../api/users";
import { Avatar } from "../../components/AppHeader";
import { FormField, inputClassName } from "../../components/FormField";
import { useToast } from "../../components/Toast";
import { useApiForm } from "../../lib/forms";
import { safeHttpUrl } from "../../lib/urls";
import { FormError, SaveButton, SettingsSection } from "./formParts";

/** Profile タブ: 表示名とアバター画像URL（アップロードは将来の拡張: manifests/users.md） */
export function ProfileTab({ user }: { user: MeResponse }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? "");
  const form = useApiForm(updateProfileSchema);
  const update = useUpdateProfile();
  const toast = useToast();
  const previewUrl = safeHttpUrl(avatarUrl.trim())?.href ?? null;

  function onSubmit(e: SubmitEvent) {
    e.preventDefault();
    // 空欄はアバターを外す（null）として送る
    const body = form.validate({
      displayName,
      avatarUrl: avatarUrl.trim() === "" ? null : avatarUrl,
    });
    if (!body) return;
    update.mutate(body, {
      onSuccess: () => {
        toast("Profile saved", "success");
      },
      onError: (err) => form.applyServerError(err),
    });
  }

  return (
    <SettingsSection
      title="Profile"
      description="Shown on your public profile and your public trees."
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className="max-w-md space-y-4"
        data-testid="profile-form"
      >
        <div className="flex items-center gap-4">
          <Avatar name={displayName || user.displayName} url={previewUrl} size="lg" />
          <p className="text-sm text-slate-600">@{user.username}</p>
        </div>
        <FormField
          id="profile-displayName"
          label="Display name"
          error={form.fieldErrors.displayName}
        >
          {(props) => (
            <input
              {...props}
              value={displayName}
              maxLength={50}
              onChange={(e) => {
                setDisplayName(e.target.value);
              }}
              className={inputClassName}
            />
          )}
        </FormField>
        <FormField
          id="profile-avatarUrl"
          label="Avatar image URL"
          hint="Optional. An http or https link to an image. Leave empty to remove."
          error={form.fieldErrors.avatarUrl}
        >
          {(props) => (
            <input
              {...props}
              type="url"
              inputMode="url"
              value={avatarUrl}
              placeholder="https://…"
              onChange={(e) => {
                setAvatarUrl(e.target.value);
              }}
              className={inputClassName}
            />
          )}
        </FormField>
        <FormError message={form.formError} />
        <SaveButton pending={update.isPending} testId="profile-save" />
      </form>
    </SettingsSection>
  );
}
