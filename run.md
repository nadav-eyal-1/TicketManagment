# IssueFlow – Setup & Run

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [npm](https://www.npmjs.com/) v9+
- [Docker](https://www.docker.com/) with Docker Compose

---

## 1. Install Dependencies

```bash
npm install
```

---

## 2. Start the Database

```bash
docker compose up -d
```

This starts PostgreSQL on port `5432` with:
- **User**: `issueflow`
- **Password**: `issueflow`
- **Database**: `issueflow`

---

## 3. Build & Start the Server

```bash
npm run build
npm run start:prod
```

The server starts on **http://localhost:3000**.

---

## 4. Run the Tests

**Unit tests:**
```bash
npm run test
```

**End-to-end (e2e) tests:**

> Requires the Docker Compose database to be running (step 2).

```bash
npm run test:e2e
```
