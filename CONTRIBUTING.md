# Contributing to Agrocylo-Global

Thank you for your interest in contributing to Agrocylo-Global! This guide explains how to get started.

## Overview

Agrocylo-Global is an Agro-DeFi platform built on Stellar/Soroban. The repository contains:

- **Production focus:** `agro-production/` — campaign-based crowdfunding (current Stellar Wave program)
- **Marketplace:** Root `client/` and `server/` — peer-to-peer trade (mature, lower priority)
- **Smart contracts:** `contracts/` and `agro-production/contract/` (Rust/Soroban)

**New to the repo?** Start with [ARCHITECTURE.md](ARCHITECTURE.md) to understand the structure.

---

## How to Contribute

### 1. Find an Issue

Issues are tracked in **[GitHub Issues](https://github.com/Cylo-Traders/Agrocylo-Global/issues)**.

**Browse labels:**
- `area:frontend` — Next.js/React work
- `area:backend` — Express/Node.js work
- `area:contracts` — Rust/Soroban work
- `type:bug` — Bugs
- `type:feature` — New features
- `type:refactor` — Code quality
- `good-first-issue` — Recommended for new contributors
- `Stellar Wave` — Suitable for external contribution (bounty-eligible)

### 2. Discuss Before Starting

Comment on the issue to let maintainers know you're interested. For substantial features, wait for feedback before starting work.

### 3. Set Up Locally

#### For Frontend

`client` and `agro-production/client` are npm workspace members (Issue
#755) sharing a single root-level install — install once from the repo
root, not inside each app's own directory:

```bash
npm install   # from the repo root; installs both client apps + packages/*

# then run either app:
npm run dev --workspace=client                        # root marketplace, http://localhost:3000
npm run dev --workspace=agro-production/client         # production app

# or use Turborepo to build/lint/test both at once:
npm run build   # runs `turbo run build` across all workspace packages
```

Shared code (design-system primitives, wallet/auth hooks, common types)
lives under `packages/*` — see `packages/wallet-core` for the first
extracted example. If you're duplicating something that already exists in
one app while working on the other, that's a signal it belongs in a shared
package instead.

#### For Backend
```bash
cd agro-production/server  # or cd server/ for root marketplace
npm install
npm run dev
# Server runs on http://localhost:3001
```

#### For Smart Contracts (Rust/Soroban)
```bash
# Install toolchain (one-time) — see docs/TOOLCHAIN.md for pinned versions
rustup target add wasm32v1-none
cargo install stellar-cli --version "22.8.1" --locked

# Build & test all contracts
cd agro-production/contract
cargo fmt --all                      # Format code
cargo clippy --workspace --all-targets -- -D warnings  # Lint (fail on warnings)
cargo test --workspace              # Run all tests
cargo check --workspace             # Pre-commit check
cargo build --workspace --target wasm32v1-none --release  # Release build

# For individual contract (e.g., production_escrow)
cd agro-production/contract/production_escrow
cargo test
```

See `docs/TOOLCHAIN.md` for complete version info and `respective README.md` files in each directory for more details.

### 4. Make Your Changes

**Code style:**
- Follow existing patterns in the codebase
- Use TypeScript for backend/frontend (no implicit `any`)
- Use Rust's `rustfmt` for contract code
- Keep commits atomic and descriptive

**Before committing:**
- Run tests: `npm test` (frontend/backend) or `cargo test --workspace` (contracts)
- Type-check: `npm run type-check` (Node.js/React) or `cargo check --workspace` (contracts)
- Lint: `npm run lint` (Node.js) or `cargo clippy --workspace --all-targets -- -D warnings` (contracts)

**⚠️ Critical for Rust Contracts (Issue #777, #679):**
Smart contracts hold real user funds and are deployed to mainnet. Before opening a PR touching any contract code:
1. **Run `cargo check --workspace`** — catches uncompilable references, missing enum variants, and other compile errors *before* code review. This is the single highest-leverage check (see §"Why This Matters" below).
2. **Run `cargo test --workspace`** — ensure all tests pass, including regression tests
3. **`cargo fmt --all` + `cargo clippy --workspace -- -D warnings`** — ensure code style and no warnings
4. If you changed patterns in one contract, verify the change is applied consistently to other contracts that share the same pattern (e.g., `production_escrow` and `contracts/escrow` both have attester roles, governance gating, etc. — changes to one should be checked against the other per `docs/SECURITY_AUDIT.md` §14.6)

**Why This Matters (The #679 Incident):**
In a prior merge, two parallel PRs silently dropped each other's identifiers when merged — one added a new enum variant, the other also added one, and one was lost in merge resolution. No test caught it because they tested in isolation. This is why:
- **`cargo check --workspace` must pass** — CI doesn't catch this class of compile error if it's only checked per-crate
- **Full diff review is required** — visual inspection catches silent enum variant loss
- **Cross-contract consistency must be verified** — when patterns are duplicated (by design, not via shared code), both must be updated together

### 5. Write a Descriptive Commit Message

Format: `<type>: <description> (#<issue-number>)`

Examples:
```
feat: add campaign creation form (#445)
fix: prevent wallet connection stale state (#446)
refactor: consolidate escrow hooks (#447)
docs: add contribution guide (#722)
```

### 6. Open a Pull Request

- **Base branch:** `main`
- **Title:** Reference the issue (`Fix #123` or `Closes #456`)
- **Description:** Explain what you changed and why (see template in PR)
- **Tests:** Include tests for new features or bug fixes
- **No breaking changes:** If your change affects the API or contract interface, discuss with maintainers first

### 7. Code Review

Maintainers will review your PR and may request changes. Address feedback promptly.

Once approved, a maintainer will merge your PR.

#### Merge & Review Practices for Rust Contracts

Because smart contracts hold real funds and are deployed to mainnet, merge gates are strict:

1. **Rebase before merge** — don't squash-merge PRs touching `production_escrow`, `governance`, `investment_basket`, or `registry`. Rebasing preserves a clear history if we need to bisect regressions later.
2. **Full diff review before merge** — not just CI green. Verify that:
   - All references to enums actually have the variants defined
   - All cross-contract patterns (attester role, governance gating, TTL management) are applied consistently
   - No storage keys are shadowed or reused
   - All auth checks are in place
3. **Verify test coverage** — new entry points need tests. Reuse of existing patterns can reuse existing tests, but refactoring should not reduce coverage.
4. **If you changed a pattern in one contract, check the other** — `production_escrow` and `contracts/escrow` intentionally share patterns (attester, governance-gated params, dispute resolution); see `docs/SECURITY_AUDIT.md` §14.6 for the cross-contract checklist.

---

## Development Workflow

### New Features
1. File a GitHub issue with a description and proposed solution
2. Wait for feedback; ensure it aligns with project scope
3. Create a branch off `main`
4. Implement feature
5. Add tests and documentation
6. Open PR and address review feedback

### Bug Fixes
1. File or comment on an existing GitHub issue
2. Create a branch off `main`
3. Fix the bug and add a test to prevent regression
4. Open PR linking to the issue

### Documentation
1. Submit improvements to README.md, ARCHITECTURE.md, API.md, or in-code comments
2. No issue needed for minor doc fixes
3. For major additions, file an issue first

---

## Continuous Integration & Merge Gate

**CI must be green before merge.** Every workflow under `.github/workflows/` (`ci.yml`, `Server CI`, `Server E2E`, `E2E · Playwright`) is a required status check on `main` — a PR cannot merge while a check relevant to the paths it touches is red. This is enforced by branch protection on `main`, not just by convention; if you believe a required check isn't actually blocking merge for your PR, treat that as a bug and file an issue (see #745 for the tracking issue on this gap).

**Scoping:** Each workflow only runs for the paths it covers (see the `paths:` filters in each `.github/workflows/*.yml` file) — e.g. a contracts-only PR isn't blocked by the Playwright suite, but a PR touching `client/` or `agro-production/client/` is. Only the checks relevant to your PR's changed paths need to pass.

**If a required check is flaky (not a real failure caused by your change):**
1. Re-run the job first (`Re-run failed jobs` in the Actions UI, or `gh run rerun <run-id> --failed`). Most transient failures (network blips, timing-sensitive E2E steps) resolve on retry.
2. If it fails a second time with the same non-deterministic symptom, comment on your PR linking the failed run and tag a maintainer — don't just keep retrying silently.
3. Only a repo admin/maintainer can bypass a required check (via an admin merge). This is logged in the PR's merge event and timeline and should be rare — treat it as "the check itself needs fixing," and file an issue for the flaky check if one doesn't already exist.
4. Never disable or remove a required check to unblock a merge. If a check is fundamentally broken (not flaky — consistently red for reasons unrelated to your change), that's a separate bug to fix, not a reason to merge around it.

---

## Security Review Requirement (Smart Contracts)

**A new contract crate, or a new cross-contract call between existing contracts, requires a scoped security review before merge** — not an occasional retrospective one. This is what closed Issue #754 (governance, investment-basket, and the path-payment router had shipped without ever being added to `contracts/SECURITY_AUDIT.md`'s scope) and it's meant to stop the same gap from reopening for whatever ships next.

- Run through [`contracts/SECURITY_REVIEW_CHECKLIST.md`](contracts/SECURITY_REVIEW_CHECKLIST.md) — covers when it applies, what to check (authorization, cross-contract trust boundaries, arithmetic, pause/emergency response), and how to record the result.
- Record the outcome as a new dated section in [`contracts/SECURITY_AUDIT.md`](contracts/SECURITY_AUDIT.md), even if the result is "reviewed, no new findings."
- Every finding needs one of three tracked dispositions: **Fixed**, **Accepted risk** (with a written rationale), or **Scheduled** (linked to an issue). A finding with no disposition is not a completed review.

---

## Important Guidelines

### ✅ Do
- Reference GitHub issues in commits and PRs
- Write atomic, focused commits
- Include tests for new features
- Update documentation if you change APIs
- Test locally before pushing
- Ask questions in GitHub issues if unclear

### ❌ Don't
- Add new in-tree backlog documents (use GitHub Issues instead)
- Break existing functionality without discussion
- Commit large binary files (use CDN/external hosting)
- Skip tests or type-checking
- Force-push to `main` (maintainers only)
- Commit secrets or environment keys

---

## Issue Triage & Backlog

Previously, this repo maintained in-tree backlog documents (`client/issues.md`, `server/issues.md`). **These have been removed.**

**Why?**
- Duplication with GitHub Issues (the single source of truth)
- No assignment, labels, or linkage to PRs
- Quickly goes stale without continuous sync

**How to contribute ideas now:**
1. File a GitHub issue with a clear title and description
2. Add relevant labels (`type:feature`, `area:frontend`, etc.)
3. Discuss scope with maintainers before implementing

See [BACKLOG_TRIAGE.md](BACKLOG_TRIAGE.md) for details on which items from the old backlog became real issues.

---

## Repository Structure Quick Reference

| Directory | Purpose |
|-----------|---------|
| `agro-production/client/` | Campaign marketplace frontend (Next.js) |
| `agro-production/server/` | Campaign API & event indexer (Express) |
| `agro-production/contract/` | Soroban contracts (Rust) — production_escrow, registry, investment_basket, governance |
| `client/` | Root marketplace frontend (Next.js) |
| `server/` | Root marketplace API (Express) |
| `contracts/` | Other contracts (Rust) — escrow, weather-insurance |
| `ARCHITECTURE.md` | Detailed repo map and data flows |
| `.github/workflows/` | CI/CD pipelines |

For full documentation: See [ARCHITECTURE.md](ARCHITECTURE.md) and individual `README.md` files in each directory.

---

## Stellar Wave Bounty Program

Agrocylo Global participates in the **Stellar Wave issue-claim bounty program** at [drips.network](https://drips.network). External contributors can claim bounty-labeled issues and earn Stellar rewards.

### How to Participate

1. **Find a bounty** on [drips.network/Agrocylo-Global](https://drips.network) or GitHub issues with the `Stellar Wave` label
2. **Request to claim** — comment on the issue: `"I'd like to claim this bounty"` and wait for maintainer approval
3. **Work locally** — follow the setup and pre-PR expectations above (especially the Rust contract checklist if it's a contract issue)
4. **Open a PR** — reference the issue (e.g., `Closes #123`)
5. **Iterate on review** — address feedback promptly
6. **Earn your reward** — once merged, the bounty is released to your Stellar address via Stellar Wave

**Bounty amounts are set per-issue.** Check the Stellar Wave listing or GitHub issue for your issue's reward. All contributions are valued, from one-line docs fixes to multi-contract changes.

---

## Questions?

- **Repo structure:** See [ARCHITECTURE.md](ARCHITECTURE.md)
- **API endpoints:** See `server/API.md` or `agro-production/server/API.md`
- **Smart contracts:** See `contract/` or `agro-production/contract/` README files
- **Toolchain & versions:** See [docs/TOOLCHAIN.md](docs/TOOLCHAIN.md)
- **Security & audit notes:** See [contracts/SECURITY_AUDIT.md](contracts/SECURITY_AUDIT.md)
- **Issues:** Browse [GitHub Issues](https://github.com/Cylo-Traders/Agrocylo-Global/issues)
- **Stellar Wave bounties:** Check issue labels for `Stellar Wave` or visit [drips.network/Agrocylo-Global](https://drips.network)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/).

Be respectful, inclusive, and constructive in all interactions.

---

## License

All contributions are licensed under the same license as the project (see LICENSE file).

By submitting a pull request, you agree that your contribution is licensed under this license.
