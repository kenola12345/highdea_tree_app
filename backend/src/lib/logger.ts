import { env } from "../config/env.js";

type Level = "info" | "warn" | "error";
type Fields = Record<string, unknown>;

/**
 * 1行1JSONで出力する簡易ロガー。
 * パスワード・JWT・Cookie・リクエスト本文は渡さないこと（standards/security.md §9.7）。
 */
function write(level: Level, message: string, fields: Fields = {}): void {
  // テスト出力を汚さないため、テスト中は warn 以上だけ出す
  if (env.NODE_ENV === "test" && level === "info") return;
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...serialize(fields),
  });
  if (level === "info") process.stdout.write(line + "\n");
  else process.stderr.write(line + "\n");
}

/** Error はそのままだと JSON に何も出ないため、名前・メッセージ・スタックを取り出す */
function serialize(fields: Fields): Fields {
  const out: Fields = {};
  for (const [key, value] of Object.entries(fields)) {
    out[key] =
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : value;
  }
  return out;
}

export const logger = {
  info: (message: string, fields?: Fields): void => {
    write("info", message, fields);
  },
  warn: (message: string, fields?: Fields): void => {
    write("warn", message, fields);
  },
  error: (message: string, fields?: Fields): void => {
    write("error", message, fields);
  },
};
