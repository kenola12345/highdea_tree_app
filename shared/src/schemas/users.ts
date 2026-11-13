import { z } from "zod";

import {
  currentPasswordSchema,
  displayNameSchema,
  emailSchema,
  newPasswordSchema,
  usernameSchema,
} from "./auth.js";

/** http / https の URL だけを許可する（アバターは外部画像URL: manifests/users.md PATCH /api/users/me） */
const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048, "Use 2,048 characters or fewer")
  .pipe(z.url({ protocol: /^https?$/, message: "Enter an http or https image URL" }));

/**
 * プロフィール変更。変更する項目だけ送り、最低1つ必要。
 * role・email などは受け付けない（自分のロールを変えられないようにするため: manifests/users.md §6）。
 */
export const updateProfileSchema = z
  .strictObject({
    displayName: displayNameSchema.optional(),
    avatarUrl: avatarUrlSchema.nullable().optional(),
  })
  .refine((body) => body.displayName !== undefined || body.avatarUrl !== undefined, {
    message: "Send at least one field to change",
  });
export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;

/** メール・ユーザー名変更。どちらか1つ以上と、現在のパスワードが必要 */
export const updateAccountSchema = z
  .strictObject({
    email: emailSchema.optional(),
    username: usernameSchema.optional(),
    currentPassword: currentPasswordSchema,
  })
  .refine((body) => body.email !== undefined || body.username !== undefined, {
    message: "Send a new email or username",
  });
export type UpdateAccountBody = z.infer<typeof updateAccountSchema>;

/** パスワード変更。新しいパスワードは現在のものと違う必要がある（manifests/users.md PATCH /api/users/me/password） */
export const changePasswordSchema = z
  .strictObject({
    currentPassword: currentPasswordSchema,
    newPassword: newPasswordSchema,
  })
  .refine((body) => body.newPassword !== body.currentPassword, {
    message: "The new password must be different from the current one",
    path: ["newPassword"],
  });
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;

/** 退会。本人確認のためパスワードが必要 */
export const deactivateSchema = z.strictObject({
  password: currentPasswordSchema,
});
export type DeactivateBody = z.infer<typeof deactivateSchema>;
