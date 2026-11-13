---
paths: "{**/.env*,backend/src/config/**/*}"
---

# Environment Variable Standards（環境変数管理）

## トリガー（いつ参照するか）
- When adding, renaming or removing an environment variable
- When changing `.env.example` or `backend/src/config/env.ts`
- When code needs a config value or a secret

## 目的（何のために）
- To load every variable through one validated module
- To never commit secrets or expose them to the browser

## 参照ファイル
Read `standards/environment.md`. New variables also go into the manifest's §9.3 table in `manifests/common.md`.
