# Engineering standards

These standards describe how code, tests, documentation and API contracts are expected
to be written in this repository. They are intentionally pragmatic: they codify what
the project already does well and prevent regressions during modernization. When a
standard needs to change, propose an ADR instead of silently diverging.

Status: **Phase 1 baseline.** Existing workflows run Prettier, ESLint, TypeScript,
Vitest, bot/wallet tests and builds on different triggers, but PR path filters leave
coverage gaps and no check is currently required for merging. ESLint/typechecking cover
selected TypeScript, not bot/wallet/shared JavaScript; root formatting excludes wallet
files. The rules below are review expectations, not claims of universal automated
enforcement. Phase 2 adds a stable required gate.

## 1. Scope and principles

- Preserve behavior first. Refactor and modernization PRs must not change gameplay,
  scoring, leaderboards, Telegram behavior or wallet safety.
- Prefer small, explicit, boring solutions over abstraction. No framework or dependency
  without a concrete use case and, where structural, an ADR.
- One concern per PR. Do not bundle formatting-only churn, dependency bumps or unrelated
  bug fixes with functional changes.
- Keep deployables independent: game, Telegram bot and wallet Worker are separate
  applications that communicate through explicit contracts, not shared internals.

## 2. Runtime and toolchain

- Node.js **22** for all tooling and Workers-compatible source.
- ES modules everywhere; no CommonJS in application source.
- Prettier is the single formatter (`npm run format:check`). Do not hand-format around
  the formatter or introduce a second formatter.
- ESLint is a conservative correctness gate today. Do not add broad stylistic rule
  sets as part of unrelated work; formatting belongs to Prettier.
- TypeScript uses `strict`, `noUnusedLocals`, `noUnusedParameters`,
  `verbatimModuleSyntax` and `moduleResolution: "Bundler"`. Do not add `// @ts-ignore`
  or loosen compiler options to hide a type error.
- Pin dependencies in the lockfile and install with `npm ci` in CI.

## 3. Module boundaries and imports

- A deployable must not import another deployable's private source. Cross-application
  interaction goes through HTTP endpoints, Worker service bindings or published
  contract modules.
- `shared/` must remain runtime-agnostic: no Phaser, DOM APIs, Cloudflare `env`
  bindings, `wrangler` APIs, D1 calls, viem, wallet keys or blockchain transactions.
  Pure constants and deterministic functions only.
- The game client (`src/`) must not import `bot/` or `wallet/`. Bot and wallet source
  must not import Phaser or `src/game/`.
- Avoid circular dependencies. If a cycle appears, extract the shared dependency
  downward into a pure module instead of loosening boundaries.
- Use relative ESM imports with explicit `.js` extensions when importing the plain-JS
  `shared/` modules from TypeScript or Worker source.
- Import order: Node built-ins, external packages, shared/workspace modules, local
  modules. Keep it consistent within a file.
- Use `import type` for type-only imports (`verbatimModuleSyntax` requires this).
- Dependency injection is encouraged where it materially improves testability (fetch,
  RPC client, clock, storage adapters). Do not build generic DI containers,
  repositories or factories without a real second implementation.

## 4. TypeScript

- Use explicit, narrow types at module boundaries and for exported functions.
- Do not use `any`. If unavoidable for an external boundary, isolate it, validate the
  value immediately and keep the `any` local; prefer `unknown` plus a type guard.
- Runtime-validate untrusted data (HTTP bodies, query params, Telegram updates, D1
  rows, environment variables) instead of asserting a type and hoping.
- Keep game logic pure and deterministic: pass time, randomness and layout inputs in
  explicitly; do not read globals inside scoring functions.
- `readonly`/`Readonly<>` for data that must not be mutated after evaluation.
- Return discriminated unions for outcomes instead of throwing for expected grade/state
  transitions in pure logic; throw only for programmer errors or invalid input at a
  boundary.

## 5. JavaScript (Workers)

- Cloudflare Worker source is plain ESM JavaScript; validate it with `node --check` and
  the relevant test suite.
- Do not introduce TypeScript build steps in a Worker as part of unrelated work; that
  would change bundling and deployment behavior and needs its own ADR.
- Never read secrets at module top level in a way that breaks tests; receive them from
  the request `env` and fail closed when missing.
- Prefer small named functions with a single responsibility. Keep the Worker entrypoint
  focused on dispatch and composition; put domain logic in testable modules.
- No dynamic `eval`, `new Function`, shell interpolation or unsanitized SQL string
  concatenation. Use prepared D1 statements and validated values.

## 6. Error handling and logging

- Fail closed for authentication, authorization, wallet operations and anything that can
  move value. Unknown state must never be treated as success.
- Never swallow errors silently. Either handle them with a defined fallback or return a
  stable error code/class and log a safe diagnostic.
- Error responses to clients use stable machine codes (for example `INVALID_ROUND`,
  `UNAUTHORIZED`, `WALLET_UNAVAILABLE`) plus a user-safe message. Do not leak stack
  traces, upstream responses or internal identifiers.
- Logs must be structured and safe: service name, operation, outcome, correlation/round
  id, retryable flag, D1/RPC category. Never log tokens, session tokens, authorization
  headers, private keys, wallet ciphertext, Telegram user identities, invite URLs, raw
  shot traces or financial balances tied to a person.
- Reuse the existing diagnostics helpers (`bot/src/walletDiagnostics.js`,
  `wallet/src/readDiagnostics.js`) rather than inventing a parallel error vocabulary.
- Blockchain ambiguity: never treat a timeout as a failed transfer. Persisted signed
  transactions may be rebroadcast, never re-signed blindly. Preserve nonce, idempotency
  and reconciliation semantics.

## 7. Testing

- Pure game logic: Vitest tests under `src/logic/__tests__/`.
- Bot: `node:test` files under `bot/tests/`.
- Wallet: `node:test` files under `wallet/tests/`.
- Browser behavior: Playwright specs under `tests/e2e/`, run for runtime/layout/
  analytics changes and scheduled smoke checks.
- Unit tests must be deterministic, offline and fast. Inject clocks and random sources.
- Every bug fix gets a regression test that fails before the fix. Every wallet safety
  change gets tests for idempotency, authorization, malformed input and reconciliation.
- Do not weaken, skip or delete assertions to make CI pass. Do not introduce snapshot
  tests that hide meaningful changes without review.
- Cross-runtime logic (`shared/` + client + Worker) needs parity tests once the
  Phase 4 contracts package exists; until then, keep a regression test on both sides
  and call out the duplication in the PR.
- A test count is not evidence by itself: include the command and the relevant output
  summary in the PR.

## 8. Documentation

- `README.md` describes current mechanics and deployment facts only. Historical release
  notes live in `CHANGELOG.md`.
- Architecture or boundary changes update `docs/architecture/` and, when structural,
  add an ADR.
- Operational changes update `docs/runbooks/` or the wallet runbooks.
- User-visible changes add a `CHANGELOG.md` entry.
- Verify versions and commands against `package.json`, workflows and source. Do not copy
  stale claims forward (the repository previously documented "Phaser 3" after the
  Phaser 4 migration; this is exactly the failure mode to avoid).
- Use relative links for repository files and stable GitHub links for issues/workflows.
  Do not link external systems that may disappear.
- Never put credentials, private keys, webhook secrets or personal Telegram data in
  documentation, examples, tests or screenshots.

## 9. API contracts

- Every HTTP surface has an explicit request/response shape and a stable error code
  vocabulary. Document it where the endpoint lives; consumers must not depend on
  incidental implementation details.
- Validate all untrusted input at the boundary (types, ranges, allowed enums, timeline
  ordering, size limits). Reject malformed or adversarial input with a 4xx, never a
  crash.
- Authentication and authorization are server-side. Derive identity from verified
  Telegram data or a verified token; never trust a client-supplied user ID.
- Worker-to-Worker internal routes require the shared internal key and server-derived
  Telegram identity. Prefer the service binding; the existing authenticated HTTPS fallback
  remains supported. A service binding does not make the public Worker host private.
  Never give the game client the internal key or access to wallet operations.
- Preserve backward compatibility within a deployment window. Adding optional fields is
  safe; changing or removing a field requires versioning or a coordinated rollout, and
  a documented migration plan in the PR.
- Contract evolution is documented in the PR and tested with contract/parity tests.
  Do not silently change leaderboard math, token eligibility or score semantics.
- Client-detected scores remain untrusted no matter how much shared code exists. See the
  known limitation in [ARCHITECTURE.md](ARCHITECTURE.md) and issue #6.

## 10. Security

- Never commit, log, print, screenshot or paste secrets, keys, tokens, `.dev.vars` or
  personal data. GitHub secret scanning push protection is enabled; do not bypass it.
- Keep GitHub Actions permissions minimal and scoped per job. Do not interpolate
  untrusted pull-request content into shell commands.
- Do not add dependencies with install scripts or broad permissions without review.
- Wallet: keep `TRANSFERS_ENABLED=false`, `AUTO_REWARDS_ENABLED=false`,
  `MANUAL_REWARDS_ONLY=true`; never sign/approve/broadcast in tests or CI; treat any
  custody, signing-key, contract-address, chain-ID or reward-eligibility change as a
  separately reviewed financial change requiring explicit human authorization.
- Preserve Telegram webhook secret validation, private-chat enforcement, rate limits,
  payout ceilings and audit trails.

## 11. Dependencies

- Add a dependency only when it removes meaningful complexity or risk; prefer existing
  platform capabilities.
- Always update the committed lockfile. Never install with `npm install` in CI when a
  lockfile exists; the wallet will move to `npm ci` in Phase 3.
- Review Dependabot/security updates as normal PRs with tests. Major-version bumps need
  an ADR or at least a dedicated PR with migration notes.
- Do not auto-merge dependency updates that touch build, auth, crypto or wallet paths.

## 12. Review and change size

- Prefer PRs that a reviewer can understand in one sitting. Split by phase/concern.
- A PR description states behavior risk, test evidence, deployment and database impact,
  security considerations and rollback.
- Reviewers check boundaries, trust boundaries, tests, docs and secret handling—not just
  whether CI is green.
- Agents and automation never merge. A human merges after the required gates pass.
