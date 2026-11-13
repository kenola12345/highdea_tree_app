import { z } from "zod";

import {
  DISPLAY_NAME_MAX,
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
} from "../constants.js";

/** メールアドレス。前後の空白を除き小文字にしてから形式を確認する（manifests/users.md） */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Enter your email")
  .max(255, "Use 255 characters or fewer")
  .pipe(z.email("Enter a valid email address"));

/** ユーザー名。小文字にしてから 3〜30文字・a-z 0-9 _ だけを許可する（予約語の確認はサーバー側で別エラーにする） */
export const usernameSchema = z
  .string()
  .toLowerCase()
  .regex(
    new RegExp(`^[a-z0-9_]{${String(USERNAME_MIN)},${String(USERNAME_MAX)}}$`),
    `Use ${String(USERNAME_MIN)}–${String(USERNAME_MAX)} characters: a-z, 0-9 and _`,
  );

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a display name")
  .max(DISPLAY_NAME_MAX, `Use ${String(DISPLAY_NAME_MAX)} characters or fewer`);

/** 新しく設定するパスワード。8〜72文字（72 は bcrypt の上限）、それ以外の強度ルールはなし */
export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN, `Use at least ${String(PASSWORD_MIN)} characters`)
  .max(PASSWORD_MAX, `Use ${String(PASSWORD_MAX)} characters or fewer`);

/** 確認用に入力する既存のパスワード。1〜72文字 */
export const currentPasswordSchema = z
  .string()
  .min(1, "Enter your password")
  .max(PASSWORD_MAX, `Use ${String(PASSWORD_MAX)} characters or fewer`);

export const signupSchema = z.strictObject({
  email: emailSchema,
  username: usernameSchema,
  displayName: displayNameSchema,
  password: newPasswordSchema,
});
export type SignupBody = z.infer<typeof signupSchema>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: currentPasswordSchema,
});
export type LoginBody = z.infer<typeof loginSchema>;
