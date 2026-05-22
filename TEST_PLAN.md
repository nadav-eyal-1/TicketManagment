# IssueFlow NestJS — Comprehensive Test Plan

## Overview

This document covers all test cases for the IssueFlow backend, organized by module. Each section lists unit tests (service/logic level) and E2E/integration tests (HTTP level). Tests marked **⚠️** cover the hardest business rules.

---

## Test Stack

- **Unit tests**: Jest + `@nestjs/testing` (TestingModule), mock repositories via `jest.fn()`
- **E2E tests**: Jest + Supertest against a running NestJS app connected to a real test PostgreSQL DB
- **Run unit**: `npm run test`
- **Run E2E**: `npm run test:e2e`
- **Run coverage**: `npm run test:cov`

---

## Progress Tracker

| Module | Unit | E2E | Status |
|---|---|---|---|
| Auth | [ ] | [ ] | — |
| Users | [ ] | [ ] | — |
| Projects | [ ] | [ ] | — |
| Tickets — CRUD | [ ] | [ ] | — |
| Tickets — Status Lifecycle ⚠️ | [ ] | [ ] | — |
| Tickets — Optimistic Locking ⚠️ | [ ] | [ ] | — |
| Tickets — Auto-Assignment | [ ] | [ ] | — |
| Comments + Mentions | [ ] | [ ] | — |
| Audit Log | [ ] | [ ] | — |
| Dependencies | [ ] | [ ] | — |
| Attachments | [ ] | [ ] | — |
| CSV Export/Import | [ ] | [ ] | — |
| Soft Delete & Restore | [ ] | [ ] | — |
| Workload | [ ] | [ ] | — |
| Auto-Escalation Cron ⚠️ | [ ] | [ ] | — |

---

## 1. Auth

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-A1 | `AuthService.login` with valid credentials returns `{ accessToken, tokenType, expiresIn }` | Resolves with JWT payload |
| U-A2 | `AuthService.login` with wrong password throws `UnauthorizedException` | Throws |
| U-A3 | `AuthService.login` with unknown username throws `UnauthorizedException` | Throws |
| U-A4 | `AuthService.logout` adds token to deny-list | Deny-list contains the token |
| U-A5 | `JwtStrategy.validate` with a deny-listed token throws `UnauthorizedException` | Throws |
| U-A6 | `JwtAuthGuard` passes a valid, non-deny-listed token | Returns `true` |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-A1 | Login with valid credentials | POST | `/auth/login` | 200 |
| E-A2 | Login with wrong password | POST | `/auth/login` | 401 |
| E-A3 | Login with missing fields | POST | `/auth/login` | 400 |
| E-A4 | Logout with valid Bearer token | POST | `/auth/logout` | 200 |
| E-A5 | Call protected endpoint after logout (token deny-listed) | GET | `/auth/me` | 401 |
| E-A6 | `GET /auth/me` with valid token returns current user | GET | `/auth/me` | 200 |
| E-A7 | `GET /auth/me` with no token | GET | `/auth/me` | 401 |

---

## 2. Users

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-U1 | `UsersService.create` hashes the password before saving | Stored hash !== plain text |
| U-U2 | `UsersService.create` with role not in `[ADMIN, DEVELOPER]` throws `BadRequestException` | Throws |
| U-U3 | `UsersService.findById` with unknown ID throws `NotFoundException` | Throws |
| U-U4 | `UsersService.update` changes only `fullName` / `role` | Returns updated entity |
| U-U5 | `UsersService.delete` removes the user | Repository delete called once |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-U1 | Create user with all valid fields | POST | `/users` | 200 |
| E-U2 | Create user with duplicate username | POST | `/users` | 409 |
| E-U3 | Create user with invalid role | POST | `/users` | 400 |
| E-U4 | Get all users | GET | `/users` | 200 — array |
| E-U5 | Get user by valid ID | GET | `/users/:userId` | 200 |
| E-U6 | Get user by non-existent ID | GET | `/users/:userId` | 404 |
| E-U7 | Update user fullName | POST | `/users/update/:userId` | 200 |
| E-U8 | Delete user | DELETE | `/users/:userId` | 200 |
| E-U9 | Delete non-existent user | DELETE | `/users/:userId` | 404 |

---

## 3. Projects

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-P1 | `ProjectsService.create` with valid payload creates record | Returns saved entity |
| U-P2 | `ProjectsService.findById` with unknown ID throws `NotFoundException` | Throws |
| U-P3 | `ProjectsService.softDelete` sets `deletedAt` timestamp | `deletedAt` is not null |
| U-P4 | Standard `findAll` excludes soft-deleted projects | Soft-deleted project absent |
| U-P5 | `ProjectsService.restore` clears `deletedAt` | `deletedAt` is null |
| U-P6 | `restore` on a non-deleted project is a no-op or returns 200 | No error |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-P1 | Create project | POST | `/projects` | 200 |
| E-P2 | Get all projects (excludes deleted) | GET | `/projects` | 200 — array |
| E-P3 | Get project by ID | GET | `/projects/:projectId` | 200 |
| E-P4 | Get non-existent project | GET | `/projects/:projectId` | 404 |
| E-P5 | Update project name | PATCH | `/projects/:projectId` | 200 |
| E-P6 | Soft-delete project | DELETE | `/projects/:projectId` | 200 |
| E-P7 | Deleted project absent from `GET /projects` | GET | `/projects` | 200 — not in list |
| E-P8 | List soft-deleted projects (ADMIN) | GET | `/projects/deleted` | 200 |
| E-P9 | Restore soft-deleted project | POST | `/projects/:projectId/restore` | 200 |
| E-P10 | Restored project appears in `GET /projects` | GET | `/projects` | 200 — in list |

---

## 4. Tickets — CRUD

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-T1 | `TicketsService.create` with valid payload returns ticket | Entity with `isOverdue: false` |
| U-T2 | `TicketsService.findByProject` returns only non-deleted tickets of the project | Filtered list |
| U-T3 | `TicketsService.findById` with unknown ID throws `NotFoundException` | Throws |
| U-T4 | `TicketsService.softDelete` sets `deletedAt` | `deletedAt` not null |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-T1 | Create ticket with all fields | POST | `/tickets` | 200 |
| E-T2 | Create ticket missing required field | POST | `/tickets` | 400 |
| E-T3 | Get tickets by projectId | GET | `/tickets?projectId=1` | 200 — array |
| E-T4 | Get ticket by ID | GET | `/tickets/:ticketId` | 200 |
| E-T5 | Get non-existent ticket | GET | `/tickets/:ticketId` | 404 |
| E-T6 | Update ticket title | PATCH | `/tickets/:ticketId` | 200 |
| E-T7 | Soft-delete ticket | DELETE | `/tickets/:ticketId` | 200 |

---

## 5. Tickets — Status Lifecycle ⚠️

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-SL1 | Advance `TODO → IN_PROGRESS` | Accepted |
| U-SL2 | Advance `IN_PROGRESS → IN_REVIEW` | Accepted |
| U-SL3 | Advance `IN_REVIEW → DONE` | Accepted |
| U-SL4 | Backward transition `IN_PROGRESS → TODO` | Throws `BadRequestException` |
| U-SL5 | Skip transition `TODO → IN_REVIEW` | Throws `BadRequestException` |
| U-SL6 | Skip transition `TODO → DONE` | Throws `BadRequestException` |
| U-SL7 | Update any field on a `DONE` ticket | Throws `BadRequestException` |
| U-SL8 | Transition `DONE → anything` | Throws `BadRequestException` |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-SL1 | Valid forward transition | PATCH | `/tickets/:ticketId` | 200 |
| E-SL2 | Invalid backward transition | PATCH | `/tickets/:ticketId` | 400 |
| E-SL3 | Update DONE ticket | PATCH | `/tickets/:ticketId` | 400 |

---

## 6. Tickets — Optimistic Locking ⚠️

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-OL1 | Two concurrent PATCH requests with the same version number — second fails | Second throws `ConflictException` (409) |
| U-OL2 | PATCH with an outdated version number | Throws `ConflictException` |
| U-OL3 | PATCH with the current version number succeeds and increments version | `version` incremented by 1 |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-OL1 | Simulate concurrent updates — second loses | PATCH | `/tickets/:ticketId` | 409 |
| E-OL2 | Update with correct version | PATCH | `/tickets/:ticketId` | 200 |

---

## 7. Tickets — Auto-Assignment

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-AA1 | Create ticket without `assigneeId` — assigns to DEVELOPER with fewest open tickets | `assigneeId` = least-loaded developer |
| U-AA2 | Tie-breaking by registration order (older user wins) | `assigneeId` = user with lower ID |
| U-AA3 | No DEVELOPERs in project — ticket created without assignee | `assigneeId` is null |
| U-AA4 | Auto-assignment logs to AuditLog with `actor = SYSTEM`, `action = AUTO_ASSIGN` | AuditLog record created |
| U-AA5 | Create ticket with explicit `assigneeId` — no auto-assignment | `assigneeId` unchanged |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-AA1 | Create ticket without assigneeId in a project with developers | POST | `/tickets` | 200 — `assigneeId` populated |
| E-AA2 | Audit log contains AUTO_ASSIGN entry after auto-assignment | GET | `/audit-logs` | 200 — entry present |

---

## 8. Comments & Mentions

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-C1 | `CommentsService.create` with content `"Hello @jdoe!"` creates a `Mention` for user `jdoe` | `mentionedUsers` contains jdoe |
| U-C2 | `@unknownuser` in content is ignored (user does not exist) | No mention created |
| U-C3 | Update comment: new mention added, dropped mention removed | Mention list updated |
| U-C4 | `CommentsService.update` with same version succeeds | Returns updated comment |
| U-C5 | Concurrent comment edits (optimistic locking) | Second write throws `ConflictException` |
| U-C6 | Delete comment removes associated mentions | Mention records removed |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-C1 | Get comments for ticket | GET | `/tickets/:ticketId/comments` | 200 — array with `mentionedUsers` |
| E-C2 | Add comment with @mention | POST | `/tickets/:ticketId/comments` | 200 — `mentionedUsers` resolved |
| E-C3 | Add comment to non-existent ticket | POST | `/tickets/:ticketId/comments` | 404 |
| E-C4 | Update comment | PATCH | `/tickets/:ticketId/comments/:commentId` | 200 |
| E-C5 | Update comment removes stale mentions | PATCH | `/tickets/:ticketId/comments/:commentId` | 200 — `mentionedUsers` updated |
| E-C6 | Delete comment | DELETE | `/tickets/:ticketId/comments/:commentId` | 200 |
| E-C7 | Get mentions for user (paginated) | GET | `/users/:userId/mentions` | 200 — `{ data, total, page }` |
| E-C8 | Get mentions — page 2 | GET | `/users/:userId/mentions?page=2&pageSize=5` | 200 |

---

## 9. Audit Log

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-AL1 | `AuditLogInterceptor` writes a record on POST | AuditLog repo `save` called |
| U-AL2 | `AuditLogInterceptor` writes a record on PATCH | AuditLog repo `save` called |
| U-AL3 | `AuditLogInterceptor` writes a record on DELETE | AuditLog repo `save` called |
| U-AL4 | `AuditLogInterceptor` does NOT write on GET | AuditLog repo `save` not called |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-AL1 | Get all audit logs | GET | `/audit-logs` | 200 — array |
| E-AL2 | Filter by `entityType=TICKET` | GET | `/audit-logs?entityType=TICKET` | 200 — only TICKET entries |
| E-AL3 | Filter by `entityId` | GET | `/audit-logs?entityId=1` | 200 |
| E-AL4 | Filter by `action=CREATE` | GET | `/audit-logs?action=CREATE` | 200 |
| E-AL5 | Filter by `actor=SYSTEM` | GET | `/audit-logs?actor=SYSTEM` | 200 |
| E-AL6 | Creating a ticket produces an audit entry | POST `/tickets` then GET `/audit-logs` | — | Audit entry present |

---

## 10. Ticket Dependencies

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-D1 | Add dependency where both tickets belong to the same project | Saved successfully |
| U-D2 | Add dependency where tickets are in different projects | Throws `BadRequestException` |
| U-D3 | Add self-dependency (`ticketId == blockedBy`) | Throws `BadRequestException` |
| U-D4 | Transition ticket to `DONE` when blocker is not `DONE` | Throws `BadRequestException` |
| U-D5 | Transition ticket to `DONE` when all blockers are `DONE` | Accepted |
| U-D6 | Remove a dependency | Relation removed |
| U-D7 | List dependencies returns all blockers with id, title, status | Correct shape |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-D1 | Add valid dependency | POST | `/tickets/:ticketId/dependencies` | 200 |
| E-D2 | Add dependency across projects | POST | `/tickets/:ticketId/dependencies` | 400 |
| E-D3 | List dependencies | GET | `/tickets/:ticketId/dependencies` | 200 |
| E-D4 | Attempt DONE transition with unresolved blocker | PATCH | `/tickets/:ticketId` | 400 |
| E-D5 | DONE transition after all blockers resolved | PATCH | `/tickets/:ticketId` | 200 |
| E-D6 | Remove dependency | DELETE | `/tickets/:ticketId/dependencies/:blockerId` | 200 |

---

## 11. Attachments

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-AT1 | Upload valid PNG (< 10 MB) | Metadata record saved |
| U-AT2 | Upload file exceeding 10 MB | Throws `BadRequestException` |
| U-AT3 | Upload disallowed MIME type (e.g. `.exe`) | Throws `BadRequestException` |
| U-AT4 | Upload `application/pdf` | Accepted |
| U-AT5 | Upload `text/plain` | Accepted |
| U-AT6 | Delete attachment removes file and DB record | Both deleted |
| U-AT7 | Delete non-existent attachment | Throws `NotFoundException` |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-AT1 | Upload valid PNG | POST | `/tickets/:ticketId/attachments` | 200 — returns metadata |
| E-AT2 | Upload oversized file | POST | `/tickets/:ticketId/attachments` | 400 |
| E-AT3 | Upload invalid MIME type | POST | `/tickets/:ticketId/attachments` | 400 |
| E-AT4 | Delete attachment | DELETE | `/tickets/:ticketId/attachments/:attachmentId` | 200 |
| E-AT5 | Delete non-existent attachment | DELETE | `/tickets/:ticketId/attachments/:attachmentId` | 404 |

---

## 12. CSV Export / Import

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-CSV1 | Export produces correct CSV columns: id, title, description, status, priority, type, assigneeId | Headers match spec |
| U-CSV2 | Export with no tickets returns header row only | No data rows |
| U-CSV3 | Import valid CSV — all rows succeed | `{ created: N, failed: 0, errors: [] }` |
| U-CSV4 | Import CSV with one invalid row (missing required field) | `{ created: N-1, failed: 1, errors: [...] }` |
| U-CSV5 | Import CSV with invalid status value | Row counted in `failed` with descriptive error |
| U-CSV6 | Import CSV with no `projectId` in form data | Throws `BadRequestException` |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-CSV1 | Export tickets for a project | GET | `/tickets/export?projectId=1` | 200 — `Content-Type: text/csv` |
| E-CSV2 | Export with unknown projectId | GET | `/tickets/export?projectId=999` | 200 — empty CSV (or 404) |
| E-CSV3 | Import valid CSV | POST | `/tickets/import` | 200 — `{ created, failed, errors }` |
| E-CSV4 | Import CSV with partial failures | POST | `/tickets/import` | 200 — errors array populated |
| E-CSV5 | Import non-CSV file | POST | `/tickets/import` | 400 |
| E-CSV6 | Import without projectId | POST | `/tickets/import` | 400 |

---

## 13. Soft Delete & Restore

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-SD1 | Soft-deleted ticket absent from `findByProject` | Not in list |
| U-SD2 | `listDeleted` (ADMIN) returns only soft-deleted tickets for project | Correct list |
| U-SD3 | `restore` clears `deletedAt` on ticket | `deletedAt` is null |
| U-SD4 | Restore non-existent ticket | Throws `NotFoundException` |
| U-SD5 | Non-ADMIN cannot call `listDeleted` | Throws `ForbiddenException` |
| U-SD6 | Non-ADMIN cannot call `restore` | Throws `ForbiddenException` |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-SD1 | Soft-delete ticket disappears from normal list | DELETE + GET | `/tickets/:ticketId` → `/tickets?projectId=` | 200 — absent |
| E-SD2 | List deleted tickets (ADMIN) | GET | `/tickets/deleted?projectId=1` | 200 |
| E-SD3 | Restore ticket (ADMIN) | POST | `/tickets/:ticketId/restore` | 200 |
| E-SD4 | Restored ticket reappears in normal list | GET | `/tickets?projectId=1` | 200 — present |
| E-SD5 | List deleted tickets as non-ADMIN | GET | `/tickets/deleted?projectId=1` | 403 |
| E-SD6 | Same flow for projects | DELETE + GET + POST | `/projects/:projectId` → `/projects/deleted` → `/projects/:projectId/restore` | 200 |

---

## 14. Workload API

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-W1 | Returns only DEVELOPER users | ADMIN excluded |
| U-W2 | `openTicketCount` counts non-DONE, non-deleted tickets | Correct count |
| U-W3 | Result sorted ascending by `openTicketCount` | Correct order |
| U-W4 | Project with no developers returns empty array | `[]` |

### E2E Tests

| # | Description | Method | Endpoint | Expected Status |
|---|---|---|---|---|
| E-W1 | Get workload for project | GET | `/projects/:projectId/workload` | 200 — sorted array |
| E-W2 | Get workload for non-existent project | GET | `/projects/:projectId/workload` | 404 |

---

## 15. Auto-Escalation Cron ⚠️

### Unit Tests

| # | Description | Expected |
|---|---|---|
| U-E1 | Ticket with `dueDate < now`, `priority=LOW`, status not `DONE` — escalates to `MEDIUM` | `priority = MEDIUM` |
| U-E2 | Escalation chain: `LOW → MEDIUM → HIGH → CRITICAL` over multiple runs | Each run bumps one level |
| U-E3 | Ticket already at `CRITICAL` — not escalated further (idempotent) | `priority` unchanged |
| U-E4 | `DONE` ticket — never escalated | `priority` unchanged |
| U-E5 | Ticket without `dueDate` — never escalated | `priority` unchanged |
| U-E6 | Ticket with `dueDate > now` — not escalated | `priority` unchanged |
| U-E7 | Reaching `CRITICAL` sets `isOverdue = true` | `isOverdue = true` |
| U-E8 | Manual priority update resets `isOverdue = false` | `isOverdue = false` |
| U-E9 | Each escalation writes an AuditLog entry with `actor = SYSTEM` | AuditLog record created |
| U-E10 | Running the job twice on the same ticket does not double-escalate | `priority` bumped exactly once per run |

### Integration Tests (trigger cron manually)

| # | Description | Expected |
|---|---|---|
| I-E1 | Call escalation service method directly with an overdue LOW ticket | `priority = MEDIUM`, audit entry created |
| I-E2 | CRITICAL ticket remains CRITICAL after calling escalation | No change |

---

## 16. Input Validation (Cross-cutting)

| # | Description | Expected Status |
|---|---|---|
| V1 | POST body with extra unknown fields | 400 (if `whitelist` + `forbidNonWhitelisted`) or ignored |
| V2 | Required string field sent as number | 400 |
| V3 | `dueDate` as non-ISO-8601 string | 400 |
| V4 | `priority` outside enum values | 400 |
| V5 | `type` outside enum values (`BUG`, `FEATURE`, `TASK`) | 400 |
| V6 | `status` outside enum values | 400 |
| V7 | `role` outside `[ADMIN, DEVELOPER]` | 400 |
| V8 | Negative / non-integer ID in path param | 400 or 404 |

---

## 17. Authorization (Cross-cutting)

| # | Description | Expected Status |
|---|---|---|
| Z1 | Any protected endpoint called without `Authorization` header | 401 |
| Z2 | Any protected endpoint called with expired token | 401 |
| Z3 | Any protected endpoint called with malformed token | 401 |
| Z4 | ADMIN-only endpoint called by DEVELOPER | 403 |

---

## Test Data Setup (E2E)

Each E2E suite should seed and clean up data:

```
Before all:
  - Create a test ADMIN user (for ADMIN-only endpoints)
  - Create a test DEVELOPER user (for workload / auto-assignment)
  - Login both users, store tokens
  - Create a test project

After all:
  - Delete created test data
  - Or truncate tables in test DB
```

Use a dedicated test database to avoid polluting development data. Set `NODE_ENV=test` and point TypeORM to the test DB in `jest-e2e.json`.

---

## Coverage Targets

| Layer | Target |
|---|---|
| Services (unit) | ≥ 80% line coverage |
| Controllers (unit) | ≥ 70% line coverage |
| E2E happy paths | 100% of documented endpoints |
| E2E error paths | All ⚠️ sections + auth/validation |
