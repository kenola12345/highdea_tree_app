import type { MeResponse } from "@highdea/shared";
import { useState } from "react";

import { ChangeEmailUsernameForm } from "./ChangeEmailUsernameForm";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { SettingsSection } from "./formParts";

/** Account タブ: メール・ユーザー名、パスワード、退会 */
export function AccountTab({ user }: { user: MeResponse }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="space-y-6">
      <ChangeEmailUsernameForm user={user} />
      <ChangePasswordForm />
      <SettingsSection title="Delete account" description="Permanently close your account.">
        <button
          type="button"
          onClick={() => {
            setDeleting(true);
          }}
          data-testid="delete-account-button"
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Delete account
        </button>
      </SettingsSection>
      <DeleteAccountModal
        open={deleting}
        onClose={() => {
          setDeleting(false);
        }}
      />
    </div>
  );
}
