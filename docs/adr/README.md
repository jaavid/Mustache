# Architecture Decision Records

We record significant architecture and engineering decisions as small, immutable
Architecture Decision Records (ADRs). The goal is to make the reasoning discoverable to
future maintainers and coding agents without re-litigating settled trade-offs.

## When an ADR is required

Write or update an ADR when a change:

- introduces or removes a deployable component, shared package or external service;
- changes a module boundary, dependency direction or cross-application contract;
- changes package management, build tooling, CI gate architecture or release strategy;
- introduces a framework, database, infrastructure component or significant dependency;
- changes wallet custody, signing, reward distribution or a security control;
- accepts a known irreversible or hard-to-reverse trade-off.

Small bug fixes and purely local refactors do not need an ADR.

## Rules

- ADRs are numbered sequentially: `0001-short-title.md`.
- Once **Accepted**, an ADR is immutable except for status changes and links to
  superseding ADRs. Correct the record with a new ADR instead of rewriting history.
- Status values: `Proposed`, `Accepted`, `Rejected`, `Superseded by ADR-NNNN`,
  `Deprecated`.
- The PR that implements the decision includes the ADR and a link from
  `docs/architecture/README.md` when the boundary changes.
- Use [0000-template.md](0000-template.md) as the starting point.

## Index

| ADR                                                  | Status   | Decision                                                     |
| ---------------------------------------------------- | -------- | ------------------------------------------------------------ |
| [0001](0001-record-architecture-decisions.md)        | Accepted | Record architecture decisions in lightweight ADRs            |
| [0002](0002-adopt-modular-monorepo-incrementally.md) | Accepted | Adopt a modular monorepo and migrate incrementally in phases |

Planned decisions that will get their own ADR when implemented:

- npm workspaces and a single root lockfile (Phase 3);
- the shared gameplay-rules/contracts package boundary (Phase 4);
- module splits for the bot, wallet and game scenes (Phase 5);
- release versioning, observability and incident-response conventions (Phase 6).
