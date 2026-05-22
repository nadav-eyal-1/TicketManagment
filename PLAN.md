# IssueFlow NestJS — Project Plan

## Stack
- **Language:** TypeScript 5.x
- **Framework:** NestJS 11
- **Database:** PostgreSQL via TypeORM
- **Auth:** JWT + passport-jwt
- **Scheduler:** @nestjs/schedule (cron)

---

## Phase 1 — Project setup & foundation

- [ ] **Install packages & configure TypeORM**
  - `npm install @nestjs/jwt passport passport-jwt bcrypt @nestjs/schedule cache-manager`
  - `npm install -D @types/bcrypt @types/passport-jwt`
  - Wire `TypeOrmModule` in `app.module.ts` with postgres config from `compose.yml`
  - Difficulty: easy

- [ ] **Define all TypeORM entities**
  - `User`, `Project`, `Ticket`, `Comment`, `AuditLog`, `TicketDependency`, `Attachment`, `Mention`
  - Get all relations and enums right before writing any logic
  - Difficulty: medium

- [] **Global validation pipe + error filter**
  - Enable `ValidationPipe` globally in `main.ts`
  - Add a global exception filter for clean error responses
  - Difficulty: easy

---

## Phase 2 — Auth & users

- [ ] **Auth module — login / logout / me**
  - `POST /auth/login` returns signed JWT
  - `POST /auth/logout` adds token to in-memory deny-list (cache-manager)
  - `GET /auth/me` returns current user from JWT payload
  - Difficulty: medium

- [ ] **JwtAuthGuard + JwtStrategy**
  - Guard validates token signature and checks deny-list
  - Apply globally or per-controller
  - Difficulty: medium

- [ ] **Users module — CRUD**
  - Register, get by ID, update (fullName/role), delete, list all
  - Hash password on create with bcrypt
  - Role must be `ADMIN` or `DEVELOPER`
  - Difficulty: easy

---

## Phase 3 — Projects & tickets (core)

- [ ] **Projects module — CRUD + soft delete**
  - Create, get, update, soft-delete, list
  - Use `deletedAt` timestamp column; standard queries exclude deleted records
  - Difficulty: easy

- [ ] **Tickets — CRUD + status lifecycle** ⚠️
  - Status can only advance: `TODO → IN_PROGRESS → IN_REVIEW → DONE`
  - Reject backward transitions
  - Reject any update to a `DONE` ticket
  - Difficulty: hard

- [ ] **Ticket optimistic locking** ⚠️
  - Use TypeORM `@VersionColumn` so concurrent PATCH requests fail with a conflict error for the second writer
  - Difficulty: hard

- [ ] **Auto-assignment on ticket create**
  - If no `assigneeId`, query non-DONE ticket counts per DEVELOPER in the project
  - Assign to lowest count (ties broken by registration order)
  - Log to audit with `actor = SYSTEM`, `action = AUTO_ASSIGN`
  - Difficulty: medium

---

## Phase 4 — Comments & audit log

- [ ] **Comments module — CRUD + locking + mentions**
  - Add, list, update, delete comments
  - Optimistic locking on concurrent edits
  - Parse `@username` from content, resolve to user IDs, persist as `Mention` records
  - Re-evaluate mention list on update (add new, remove dropped)
  - Difficulty: medium

- [ ] **Audit log interceptor + GET endpoint**
  - NestJS interceptor writes to `AuditLog` on every POST/PATCH/DELETE
  - `GET /audit-logs` with optional filters: `entityType`, `entityId`, `action`, `actor`
  - Difficulty: medium

---

## Phase 5 — Extended features

- [ ] **Ticket dependencies**
  - `POST /tickets/:id/dependencies` with `{ blockedBy: 42 }`
  - `GET /tickets/:id/dependencies` — list all blockers
  - `DELETE /tickets/:id/dependencies/:blockerId`
  - Block `DONE` transition if any blocker ticket is not `DONE`
  - Both tickets must belong to the same project
  - Difficulty: medium

- [ ] **Attachments — upload & delete**
  - `POST /tickets/:id/attachments` with Multer (multipart)
  - Validate: max 10MB, allowed types: `image/png`, `image/jpeg`, `application/pdf`, `text/plain`
  - Persist file metadata; `DELETE` removes both file and record
  - Difficulty: easy

- [ ] **CSV export & import**
  - `GET /tickets/export?projectId=` streams CSV with fields: id, title, description, status, priority, type, assigneeId
  - `POST /tickets/import` accepts multipart CSV + `projectId`, returns `{ created, failed, errors }`
  - Use `csv-stringify` and `csv-parse` (already in package.json)
  - Difficulty: medium

- [ ] **Soft delete — list deleted & restore**
  - `GET /tickets/deleted?projectId=` and `GET /projects/deleted` — ADMIN only
  - `POST /tickets/:id/restore` and `POST /projects/:id/restore` — ADMIN only
  - Difficulty: easy

- [ ] **Mentions API**
  - `GET /users/:userId/mentions` — paginated, newest first
  - Include `mentionedUsers: [{ id, username, fullName }]` in all comment responses
  - Difficulty: easy

- [ ] **Workload API**
  - `GET /projects/:projectId/workload` returns `[{ userId, username, openTicketCount }]` sorted ascending
  - Difficulty: easy

---

## Phase 6 — Scheduled jobs & automation

- [ ] **Auto-escalation cron job** ⚠️
  - Run periodically (e.g. every minute or hourly)
  - Find tickets where `dueDate < now` and `priority < CRITICAL` and status is not `DONE`
  - Bump priority one level: `LOW → MEDIUM → HIGH → CRITICAL`
  - Set `is_overdue = true` when reaching `CRITICAL`
  - Escalation is idempotent — never escalate beyond CRITICAL
  - Manual priority change resets `is_overdue` and the escalation state
  - Log each escalation to audit with `actor = SYSTEM`
  - Difficulty: hard

---

## Phase 7 — Tests & documentation

- [ ] **Unit tests — ticket logic**
  - Status lifecycle rejection
  - DONE ticket lock
  - Optimistic locking conflict
  - Auto-escalation idempotency
  - Difficulty: medium

- [ ] **E2E tests — happy paths**
  - Auth login/logout, user CRUD, project + ticket flow
  - Comment with @mention
  - CSV export/import
  - Difficulty: medium

- [ ] **Write run.md** (required by assignment)
  - Prerequisites, `docker compose up`, `npm install`, environment variables, `npm run start:dev`
  - Difficulty: easy

---

## Key packages to add

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt @nestjs/schedule cache-manager
npm install -D @types/bcrypt @types/passport-jwt
```

Already included in `package.json`: `typeorm`, `pg`, `class-validator`, `class-transformer`, `multer`, `csv-parse`, `csv-stringify`

---

## Entity relationships (quick reference)

| Entity | Relation |
|--------|----------|
| User → Project | owner (M:1) |
| Project → Ticket | 1:N |
| Ticket → Comment | 1:N |
| Ticket → Ticket | M:N (dependencies) |
| Comment → User | M:N (mentions) |
| Ticket → Attachment | 1:N |
| All mutations → AuditLog | append-only |

---

## Notes

- The assignment requires documenting AI usage — keep notes on which prompts/models you used
- Model used: Claude Sonnet 4.6
- Start with entities before writing any controller/service logic
- The three hardest parts are: ticket lifecycle validation, optimistic locking, and escalation cron idempotency