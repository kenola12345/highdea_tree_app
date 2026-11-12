# CLAUDE.md

## Project

**Highdea Tree** — a web app to visualize and organize ideas. A user starts with a central idea and branches it out into child nodes (text, links, videos). Trees can be categorized, kept private, or shared publicly for others to browse.

**MANIFEST.md is the source of truth** for features, data model, API, and stack. Read the relevant section before implementing anything, and don't contradict it. If a change is needed, update MANIFEST.md first (or ask).

## Status

Planning stage. Only `MANIFEST.md` and `CLAUDE.md` exist — no code yet. Don't scaffold or implement features unless asked.

## Stack (summary — see MANIFEST.md §7)

- Monorepo: `frontend/` and `backend/`
- TypeScript everywhere (`strict: true`)
- Frontend: React + Vite, React Router, TanStack Query, Tailwind CSS, custom SVG + D3 for the tree canvas
- Backend: Node.js + Express, Zod, Prisma, PostgreSQL (Docker Compose), JWT in httpOnly cookie, Multer for image uploads (local disk in dev)
- IDs: `cuid` strings

## Conventions

- No `any`; prefer explicit types for API request/response shapes.
- Validate all request input with Zod on the backend.
- API responses: `{ data }` on success, `{ error: { code, message } }` on failure.
- Authorization: users may only modify their own trees, nodes, and categories. Private trees are visible only to their owner — not even to admins. Admins can only remove public trees.
- Keep business logic in `services/`, not in route handlers.
- Never commit `.env` files or secrets.

## Commands

TBD — added once the project is scaffolded (Phase 1).
