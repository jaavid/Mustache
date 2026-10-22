# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** repository owner (@jaavid)
- **Related:** [Governance](../GOVERNANCE.md), [engineering standards](../ENGINEERING_STANDARDS.md)

## Context

The repository evolved from a standalone Phaser prototype into a monorepo containing a
game, a Telegram Worker, a testnet wallet Worker and shared scoring rules. Important
constraints are spread across README, AGENTS.md, workflow files, code comments and
wallet runbooks. Future contributors and coding agents repeatedly need to rediscover:

- why the game and the Worker share only some rules;
- why scores are not prize-grade;
- why wallet deployment is manual and transfers are disabled;
- which refactors are allowed and which are out of scope.

Without a decision record, refactors risk changing behavior or weakening security
controls, and later contributors cannot tell a deliberate trade-off from an accident.

## Decision

Adopt lightweight Architecture Decision Records stored in `docs/adr/`:

- one file per decision, numbered `NNNN-title.md`;
- statuses `Proposed`, `Accepted`, `Rejected`, `Superseded by`, `Deprecated`;
- accepted decisions are immutable except for status and links;
- architecture, boundary, tooling, deployment, custody and security-control changes
  require an ADR in the same pull request;
- the template is [0000-template.md](0000-template.md) and the index is
  [README.md](README.md).

This ADR itself documents the process, not a runtime architecture choice.

## Alternatives considered

| Alternative                                       | Why not chosen                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| Keep decisions in commit messages only            | Hidden from contributors who do not read full history              |
| Maintain a single large architecture document     | Becomes stale; no clear authorship or status for each decision     |
| Use an external wiki or issue tracker             | Not versioned with the code that implements the decision           |
| Heavyweight RFC template with multi-week approval | Disproportionate for a small repo; discourages necessary decisions |

## Consequences

### Positive

- Trade-offs and non-goals are visible before a change lands.
- Security and wallet decisions have a durable, linkable rationale.
- Coding agents can follow explicit constraints instead of guessing.

### Negative / accepted trade-offs

- Small documentation overhead for architecture-level PRs.
- ADRs can become stale if reviewers do not enforce updates; the index and PR checklist
  mitigate this and Phase 6 will add a docs validation pass.

### Risks and mitigations

- **Risk:** ADRs become a rubber stamp. **Mitigation:** require concrete alternatives and
  consequences, and link verification evidence.
- **Risk:** conflicting decisions. **Mitigation:** supersede rather than edit; index.

## Compatibility and rollout

- Behavior change: none.
- Deployment impact: none.
- Data impact: none.
- Security impact: none directly; improves traceability of future security decisions.

## Follow-ups

- Add an ADR for workspace migration (Phase 3), shared contracts (Phase 4), module
  boundaries (Phase 5) and release engineering (Phase 6).
