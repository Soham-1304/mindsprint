# Design System — PatchUP Dashboard

## Visual World & Mode
- **Mode:** Operate (production SRE workspace). Clarity, scanability, and live state outrank ornament.
- **Hierarchy:** Projects is the top-level home (`/projects`). Clicking a project enters its 5-tab workspace (`/p/:id`: `Overview`, `Incidents`, `Security gate`, `Signals & setup`, `Settings`). The project name appears once in the top breadcrumb switcher.

## Palette
| Role | Token | Value | Usage |
|---|---|---|---|
| Canvas ground | `--background` | `#FAF8F5` | Warm ivory page ground & 3D studio stage |
| Surface | `--card` | `#FFFFFF` | Cards, tables, sheets, charts |
| Hairline border | `--border` | `#EAE2D9` | Structural separation, table dividers |
| Primary ink | `--foreground` | `#181614` | Headings, values, active tabs |
| Secondary ink | `--muted-foreground` | `#665E56` | Descriptions, table headers |
| Signal orange | `--primary` | `#FF5500` | Primary actions, active tab underline, brand brush mark, active error charts |
| Healthy / Safe | `--chart-positive` | `#15803D` | Live indicators, 0 B retained, passing signals |
| Warning / Degraded | `--chart-4` | `#D97706` | Degraded health or review state |
| Critical / Blocked | `--destructive` | `#DC2626` | 5xx spikes, blocked pre-merge PRs |
| Agent console pane | — | `#131211` | Left execution stream inside the split Incident Detail workbench |

## Typography
- **UI Sans:** `Inter`, system sans fallback. Base `14px`, line-height `1.5`.
- **Technical Mono:** `JetBrains Mono` strictly for code, SHAs, diffs, endpoints, timestamps, and `tabular-nums` metrics.

## Components & Libraries
- **Layout & Primitives:** Tailwind CSS v4 + shadcn/ui (`Button`, `Input`, `Table`, `Badge`, `Tabs`, `Separator`), native `<dialog>` for Import Repo and Postmortem Drawer, native `<details>` for test scan menu & sandbox trace.
- **Charts:** `@bklit` (`AreaChart`, `LineChart`, `BarChart`, `AreaSparkline`, `Grid`, `XAxis`, `BarXAxis`, `ChartTooltip`) backed strictly by real backend data (`probeHistoryByProject`, `incidents`).
- **Signature & Micro-motion:**
  - Real-services 3D stacked chip tower (`@react-three/fiber` + `@react-three/drei`) on Project Overview mapping each slab to a live project component (repo + security gate, gateway, orders, payments, telemetry).
  - MagicUI `BorderBeam` + `NumberTicker` on the active incident card.
  - ReactBits-style `SpotlightCard` on the Projects home grid.
  - `anime.js` timeline stagger on the Incident Detail execution stream (`prefers-reduced-motion` respected).
