# DevBoard Documentation Index

This folder contains everything needed to build DevBoard end-to-end. Read in this order.

| # | Doc | What it covers | When you need it |
|---|---|---|---|
| — | [Readme.md](./Readme.md) | The original brief: vision, day-by-day plan, project structure | Start here — the "why" |
| 01 | [ARCHITECTURE.md](./01-ARCHITECTURE.md) | System components, request lifecycle, the Keycloak/OpenFGA split | Before writing any code |
| 02 | [DATA-MODEL.md](./02-DATA-MODEL.md) | DB schema, ER diagram, SQLAlchemy models, migrations | Day 2 |
| 03 | [AUTHORIZATION.md](./03-AUTHORIZATION.md) | OpenFGA model, tuple lifecycle, check patterns, caching | Day 3 & 5 (the core) |
| 04 | [API-SPEC.md](./04-API-SPEC.md) | Every endpoint: method, payload, authz rule, responses | Day 2 & 3 |
| 05 | [INFRASTRUCTURE.md](./05-INFRASTRUCTURE.md) | docker-compose, Keycloak realm setup, OpenFGA store bootstrap | Day 1 |
| 06 | [FRONTEND.md](./06-FRONTEND.md) | Next.js structure, auth wiring, data fetching, permission-aware UI | Day 4 |
| 07 | [TESTING.md](./07-TESTING.md) | Auth test matrix, integration tests, e2e flow | Day 6 |
| 08 | [TASK-BREAKDOWN.md](./08-TASK-BREAKDOWN.md) | Every day broken into checkbox-level tickets with acceptance criteria | Daily driver |
| 09 | [GLOSSARY.md](./09-GLOSSARY.md) | OIDC, ReBAC, OpenFGA, and domain terms defined | Reference |
| 10 | [FOLDER-STRUCTURE.md](./10-FOLDER-STRUCTURE.md) | Complete repo layout — every file, mapped to the docs that define it | Before scaffolding |

## How to use these

- **Building solo over a week?** Open `08-TASK-BREAKDOWN.md` each morning. It links back to the relevant deep-dive doc for each task.
- **Just want to understand the design?** Read `01-ARCHITECTURE.md` then `03-AUTHORIZATION.md`.
- **Stuck on a term?** `09-GLOSSARY.md`.

## Document conventions

- Code is illustrative, not copy-paste-final. It shows the pattern; you write the production version.
- `> Note:` callouts flag gotchas the original brief glosses over.
- Anything marked **(decision)** is a choice you should make consciously — the doc recommends a default.
