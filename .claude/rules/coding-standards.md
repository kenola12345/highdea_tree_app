---
paths: "**/*"
---

# Coding Standards: Where to Look（コーディング規約の参照先）

## トリガー（いつ参照するか）
- Before writing or changing any code in `shared/`, `backend/` or `frontend/`
- When creating a new file or directory, or naming variables, types, constants or files
- When creating a branch or a commit
- When reviewing code or a PR, or self-checking before a commit
- When unsure which standards file covers the task

## 目的（何のために）
- To keep naming, structure and conventions the same across the whole monorepo
- To read only the standards file the task needs, instead of all of them, to save tokens
- To stay consistent with the design in `manifests/`

## 参照ファイル
Read `standards/index.md` first. It maps each task to its file, so open only the file(s) the task needs. `standards/general.md` applies to all TypeScript code. Use `standards/git.md` for branches and commits, and `standards/review-checklist.md` for reviews.
