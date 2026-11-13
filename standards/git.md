# Coding Standards — 7. Git（Git規約）

Part of the coding standards. Start from [index.md](./index.md). Section numbers (§N) refer to the files listed there.

### 7.1 Branches

GitHub Flow: `main` is always deployable; work happens on short-lived branches and is merged by pull request.

| Prefix | Use | Example |
|---|---|---|
| `feature/` | New feature | `feature/node-lazy-loading` |
| `fix/` | Bug fix | `fix/trash-purge-timezone` |
| `docs/` | Manifest and docs only | `docs/manifest-hosting` |
| `refactor/` | No behavior change | `refactor/tree-service-helpers` |
| `chore/` | Tooling, dependencies, config | `chore/eslint-setup` |
| `test/` | Tests only | `test/nodes-api` |

- Lowercase kebab-case after the prefix. Don't commit directly to `main` once the code phase starts. Never force-push `main`.

### 7.2 Commit Messages

Format: `<type>: <Japanese subject>[<scope>]`, matching the existing history.

- `type` is half-width lowercase: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- The subject is Japanese and says what changed. `[scope]` at the end is optional: the area in lowercase English (`[nodes]`, `[auth]`, `[canvas]`).
- Under 72 characters, no period at the end. Separate several items with `・` or `、`.
- One logical change per commit. Stage specific files (`git add <path>`), never `git add -A`.
- No AI attribution lines, personal names, internal URLs or secrets in messages.

❌ Bad
```
修正
WIP
Fixed stuff in tree service and also some UI
```

✅ Good
```
feat: ノード追加APIを実装（2,000件上限・ツリー行ロック）[nodes]
fix: ゴミ箱の残り日数が1日ずれる問題を修正[trash]
test: Trees APIのSupertestテスト追加[trees]
chore: ESLint・Prettier設定追加
```
