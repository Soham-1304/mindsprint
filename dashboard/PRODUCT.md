# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Engineers who own a production web app (solo devs, small teams, hackathon/startup teams) and are on call for it. They connect a GitHub repo once, then come back to the dashboard when something breaks, when Patch-Up has opened a fix PR, or when a PR is blocked by the security gate. They arrive mid-incident or right after one: they want to know what broke, why, and whether the fix PR is safe to merge.

## Product Purpose

Patch-Up (wordmark: PatchUP) is an autonomous AI site-reliability agent. When a connected app breaks, the app pushes its recent scrubbed logs to Patch-Up; Patch-Up diagnoses the root cause, opens a surgical fix PR (never pushes to `main`), and purges everything it held in memory. Success = time from break to a reviewable, verified fix PR measured in seconds, with zero customer data retained.

## Positioning

- Push-on-break, zero retention: no log storage, no polling agents; data lives in RAM only for the duration of one diagnosis, with a purge receipt (`0 B retained`).
- PR-only remediation: the agent proposes, a human merges. Risky actions sit behind an operator-approved tier (AUTO / ASK_FIRST / NEVER).
- A pre-merge security gate on every PR and push to `main` (supply-chain detonation, typosquat checks, secret/infra diff guard), posted as a GitHub check. Internally called Sietch; in the UI it is "Patch-Up security gate", never the hero.

## Operating Context

- Trigger model (factual): push to `main` → deploy marker + security scan; PR opened/updated → security scan + GitHub check; app error/5xx → app pushes log bundle → diagnosis → fix PR. Only the last starts the agent.
- Signals per project: GitHub App, `/health`, `/metrics` (Prometheus), `/api/telemetry` (JSON), push logs (6h window), security gate. Signals are re-probed on boot and every 5 minutes.
- Integrations: GitHub App "Patch-Up SRE", Render backend, Vercel-hosted apps, Logstash, CloudWatch SNS, Alertmanager/Grafana, ntfy/Discord/Slack/PagerDuty alerts.
- AI: `gemini-3.5-flash-lite` primary, Groq `llama-3.3-70b-versatile` backup.

## Capabilities and Constraints

- Multiple projects per account; Projects is the top-level object. Each project owns its incidents, fix PRs, approvals, security scans and signals.
- Dashboard: React 18 + Vite + TypeScript, deployed on Vercel; live updates via WebSocket + SSE from the Render backend.
- Backend storage is ephemeral SQLite on Render free tier; data can reset on restart.
- Approved component sources: Bklit (charts), MagicUI, ReactBits, installed via the shadcn registry; anime.js for motion; three.js/R3F for the 3D project tower.

## Brand Commitments

- Name: Patch-Up; wordmark "PatchUP" with an orange brush underline.
- Palette pinned by the user from the teammate frontend: warm ivory ground (#FAF8F5), white surfaces, safety orange accent (#FF5500), charcoal ink (#181614).
- The 3D stacked-chip tower stays on the project overview, but every slab must represent a real part of the user's project (repo + security gate, gateway, services) with live health. No invented tiers.
- Dashboard tone: between Vercel's dashboard and the teammate's 3D frontend. Clean, dense, no decorative clutter.

## Evidence on Hand

- Live project: `Soham-1304/pulseshop` (gateway, orders, payments on Vercel), real incident `INC-20261121-001` (ERR_5XX_SPIKE, TypeError in `calculatePromoDiscount`), real fix PRs on GitHub, real security scans (`bad-package`, `low-memory` branches).
- No customers, testimonials, benchmarks or pricing exist. Do not invent them.

## Product Principles

1. Truth over theater: every number, tier and label on screen comes from the backend. If a signal is missing, say so and show how to fix it.
2. The project is the unit of work: everything is scoped to a project; nothing global pretends to be per-project.
3. Show the fix, not the process: the diff, the evidence and the merge decision lead; pipeline narration is secondary.
4. Privacy is visible: retention and purge state are always one glance away.
