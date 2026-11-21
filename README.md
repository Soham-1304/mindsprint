# Patch-Up — AI Site-Reliability Agent + Sietch 3-Layer Preventive Shield (MindSprint 2026 · AIA-02)

**Patch-Up** combines a **Push-Based, Zero-Retention AI Site-Reliability Agent** with the **Sietch 3-Layer Supply-Chain & Pre-Merge Shield**.

## Architecture

- **Push-First, Zero-Retention Privacy (`MONITORING_MODE=push-ephemeral`)**: Customer infrastructure (App Error Hooks, ELK/Logstash, Prometheus Alertmanager, Grafana, AWS CloudWatch SNS) pushes a 6-hour rolling window **only when a tracked metric breaches**. Raw logs & JIT source buffers live strictly in volatile RAM (`EphemeralVault`), are PII/secret-scrubbed before LLM analysis, and are **immediately purged** once a Fix PR + RCA Report is raised (leaving a SHA-256 **Purge Receipt** with `0 bytes retained`).
- **Multi-Tenant GitHub App & Strict PR-Only Guardrail**: Any user installs the Patch-Up GitHub App on selected or all repositories via 1-click, imports a project just like Vercel, and receives automated PRs (`patch-up[bot]`). Direct commits/pushes to `main`/`master` are permanently blocked (`POLICY_BLOCKED`).
- **Sietch 3-Layer Preventive Shield (Runs at 2 Checkpoints)**:
  1. **Pre-Merge / Push Gate**: Layer 1 behavioral detonation with 15 checksum-valid `@sietch/sandbox` honeytokens + `@sietch/core` deterministic rules (`R1–R10 & R13`), Layer 2 typosquatting/slopsquatting/`<48h` fresh-package guard, Layer 3 PR diff secrets & infra (`mem_limit: 24m`, removed `HEALTHCHECK`) guard.
  2. **Agent Self-Gate**: Runs Sietch on the Agent's own generated Fix PR diff before touching GitHub.
- **Brain (`gemini-3.5-flash-lite` + Groq `llama-3.3-70b-versatile` Backup)**: Counterfactual Strategy Planner (prevents thundering-herd restarts during retry storms), surgical `searchReplace` patching, and fail-closed `node --check` + `npm test` verification gate.
- **Unified Command Dashboard (`dashboard/`)**: Vercel-style Repo Importer, Smart 6-Signal Telemetry Readiness Bar, Live Incident Timeline & Counterfactual Matrix, 1-Tap `ASK_FIRST` Approvals Queue, Sietch Detonation Chamber, and Downloadable RCA Reports / Postmortems Drawer.

## Directory Structure

```text
mindsprint/
├── backend/              # Unified Node 24 TypeScript Control Plane + Sietch 3-Layer Suite + SQLite
├── dashboard/            # React 18 + Vite Unified Command Dashboard (Vercel)
├── demo-packages/        # Harmless @sietch-demo/currency-format-lite@1.0.2 detonation fixture
├── render.yaml           # 1-Click Render Free Docker Blueprint (Backend)
└── docker-compose.sre-agent.yml
```

## Local Quick Start

```bash
# 1. Backend (Node 24)
cd backend
npm install
cp .env.example .env
npm test
npm run dev

# 2. Dashboard (separate terminal)
cd dashboard
npm install
npm run dev
```
