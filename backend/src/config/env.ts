import { z } from "zod";

// manifests/common.md §9.3 の環境変数。アプリ内では process.env を直接読まず、必ずこの env を使う
const envSchema = z.object({
  DATABASE_URL: z.url(),
  // 署名鍵が短いと総当たりで JWT を偽造されるため32文字以上を必須にする
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.url(),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
});

export type Env = z.infer<typeof envSchema>;

/** 環境変数を検証して返す。不正・不足があれば内容を表示して終了する（起動直後に気づけるように）。 */
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:\n" + z.prettifyError(parsed.error));
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
