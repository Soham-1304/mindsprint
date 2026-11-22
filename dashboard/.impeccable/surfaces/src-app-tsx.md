---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: []
---

# PatchUP Dashboard Surface Brief

- **Mode:** Operate
- **Scope:** Full dashboard shell and routes (`/projects`, `/p/:id`, `/p/:id/incidents`, `/p/:id/incidents/:incId`, `/p/:id/security`, `/p/:id/signals`, `/p/:id/settings`).
- **Audience & Job:** On-call engineers connecting repos and reviewing live incidents, fix PRs, approvals, security gate verdicts, and telemetry signal setup.
- **Constraints:** Every number, tier, service, and diff comes from backend data; zero invented tiers or fake placeholders. Projects is top-level; no `+ Import` in the top bar; project name shown once in the breadcrumb switcher.

## Direction contract

- **THESIS:** Projects-first Vercel-clarity SRE workspace with a data-driven 3D physical service stack on the project Overview and an Impeccable dual-split incident workbench — refusing generic KPI card walls, repeated headings, and fictional hardware tiers.
- **OWN-WORLD:** Warm ivory ground `#FAF8F5`, crisp pure white `#FFFFFF` surfaces, hairline `#EAE3DA` borders, charcoal `#181614` primary ink, muted warm stone `#6F675E` secondary ink, and safety orange `#FF5500` exclusively for live actions, active traces, and brand brush mark; Inter for UI + JetBrains Mono strictly for code, SHAs, diffs, and tabular measurements.
- **STORY:** Engineer lands on `/projects` to scan repo health and open a project; inside `/p/:id` they see real services in the 3D stack + active incident + Bklit telemetry charts; clicking an incident opens the dark/light split workbench with real GitHub PR diff, ranked strategies, and 1-tap approval.
- **FIRST VIEWPORT:** 48px single-row top bar (`PatchUP` wordmark + breadcrumb switcher + live dot + Reports); on `/projects`, search + single Import button above a clean grid of SpotlightCard project cards with Bklit sparklines and 6-dot signal bars; on `/p/:id`, 5 underlined Vercel tabs (`Overview`, `Incidents`, `Security gate`, `Signals & setup`, `Settings`) directly above the 3D real-services tower + active incident summary card.
- **FORM:** Pinned user world (Vercel-clarity Operate shell + luminous ivory/orange 3D service stack + Bklit/MagicUI/ReactBits primitives); seed: none (unavailable).
- **FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
