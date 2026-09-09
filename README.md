# 🗂️ LiveBoard — Real-Time Collaborative Kanban

> Status: **phase 1 (MVP) implemented** — run `docker compose up -d && cd backend && npm run prisma:migrate` locally to try it.

## 1. Overview

A Kanban board (a simplified Trello) where multiple users connected to the same board see cards being created, moved, and edited by anyone else in real time — no refresh needed.

This project exists to prove, with public code, a skill that today only shows up in private professional experience (WebSockets/real-time). The focus is the synchronization itself, not the number of features.

## 2. Features

### MVP (phase 1)

1. **Board with fixed columns** — "To Do", "Doing", "Done". Create/edit/delete cards in each column.
2. **Synchronized drag-and-drop** — moving a card (including between columns) is instantly reflected on every other user connected to the same board.
3. **Online presence** — a list of avatars/names of whoever is currently on the board, updated as people join/leave.
4. **Activity feed** — a side panel with a log like "Lucas moved 'Fix layout' to Done at 2:32pm", fed by the same socket events.

### Phase 2 (stretch goal)

1. **Multiple boards per user** — the owner creates boards and invites collaborators via an invite-token link.
2. **Comments on cards** — a simple thread per card, also in real time.
3. **Live cursors** — show other users' mouse position on the board (a "Figma-like" effect), purely cosmetic but a good teaching example for WebSockets.

## 3. Stack

| Layer | Technology | Where it's used |
|---|---|---|
| Frontend | React + TypeScript (Vite, SPA) | Board interface, no need for SSR |
| Drag-and-drop | `dnd-kit` | Moving cards between columns on the client |
| Real time | Socket.io (client + server) | Broadcasting create/move/edit card and presence |
| Global state | Zustand | Board state synchronized with socket events |
| Auth | JWT | Simple email/password login |
| Validation | Zod | Validate socket event payloads and REST routes |
| Backend | Node + Express + Socket.io server | Business logic and the real-time layer |
| Database | PostgreSQL + Prisma | Boards, columns, cards, users, activity log |
| Local infra | Docker (WSL2) | Only Postgres, containerized |
| CI/CD | GitHub Actions | Lint + tests + build on every push/PR |
| Deploy | Frontend on Vercel · Backend on Railway or Render | WebSockets need a server with a persistent connection — doesn't run well on serverless |
| Tests | Vitest + Testing Library (front) · Vitest + socket.io-client mock (back) | Cover state logic and socket handlers |

## 4. Architecture

```
[React + TS (SPA)] <--(Socket.io + REST)--> [Node + Express + Socket.io server]
                                                       |-- Postgres (Prisma) — boards, cards, activity
                                                       |-- One socket room per board (board:<id>)
```

Each board is a Socket.io "room" (`board:<id>`). Emitted events: `card:create`, `card:move`, `card:update`, `card:delete`, `presence:join`, `presence:leave`. The server persists to Postgres and re-emits the event to every other client in the same room.

## 5. Suggested roadmap

1. **Phase 0** — setup: Vite + Express scaffolds, local Postgres via Docker, Prisma schema (Board, Column, Card, User). ✅ done
2. **Phase 1** — MVP: card CRUD + socket broadcast + synchronized drag-and-drop + online presence + activity feed. ✅ done
3. **Phase 2 — multiple boards**
   - Each user creates their own boards and invites collaborators via a token-based invite link.
   - Board switcher (sidebar/list of boards the user belongs to).
4. **Phase 3 — richer collaboration**
   - Real-time comments per card (simple thread).
   - Live cursors from other connected users (Figma-style) — cosmetic, but a strong WebSockets showcase.
   - Colored labels/tags and due dates on cards, with an overdue highlight.
5. **Phase 4 — usability**
   - Search/filter cards on the board.
   - DiceBear avatars (same UX as freeroom) instead of initials in the presence list.
   - Keyboard shortcuts, light/dark theme.
6. **Phase 5 — deploy**
   - Frontend on Vercel, backend on Railway/Render (needs a persistent process for Socket.io), managed Postgres (Neon/Supabase).

## 6. Project structure (phase 0 — scaffold only, no logic)

```
liveboard/
├── docker-compose.yml       # local Postgres
├── .github/workflows/ci.yml # lint + test + build (front and back)
├── backend/
│   ├── prisma/schema.prisma
│   └── src/
│       ├── index.ts         # Express + Socket.io server wiring
│       ├── sockets/         # event handlers (card:move, presence, etc.)
│       ├── routes/  controllers/  services/  middlewares/  config/
└── frontend/
    └── src/
        ├── components/  pages/  hooks/  store/  services/  types/
```

Run in dev:

```
docker compose up -d          # start Postgres
cd backend  && npm run dev    # API + Socket.io at http://localhost:3333
cd frontend && npm run dev    # Vite at http://localhost:5173
```

## 7. Open decisions

- Final project name.
- Invite-based auth (URL token) or does a user need an account before joining a board?
- Is it worth persisting the activity history permanently, or just keeping it in memory while the board is active?
