export type LayerHealthState = "HEALTHY" | "DEGRADED" | "CRITICAL" | "RECOVERING" | "UNKNOWN";

export type TowerNodeId =
  | "git-sep"
  | "frontend-service"
  | "gateway-service"
  | "backend-service"
  | "ai-engine";

export interface TowerNodeMeta {
  id: TowerNodeId;
  tierLabel: string;
  name: string;
  shortRole: string;
  description: string;
  mappedService?: "gateway" | "orders" | "payments";
}

export const TOWER_NODES: Record<TowerNodeId, TowerNodeMeta> = {
  "git-sep": {
    id: "git-sep",
    tierLabel: "Tier 00",
    name: "GitHub Repository & Pre-Merge Gate",
    shortRole: "PR-Only VCS & Supply-Chain Shield",
    description:
      "Monitors push and pull_request webhooks, blocks malicious packages or unsafe infra configs pre-merge, and opens Fix PRs on isolated branches.",
  },
  "frontend-service": {
    id: "frontend-service",
    tierLabel: "Tier 01",
    name: "Storefront Frontend",
    shortRole: "Edge Web Client",
    description:
      "Customer-facing web application served at the edge. Routes checkout and catalog traffic through the API Gateway.",
    mappedService: "gateway",
  },
  "gateway-service": {
    id: "gateway-service",
    tierLabel: "Tier 02",
    name: "API Gateway",
    shortRole: "Ingress & Prometheus Metrics",
    description:
      "Reverse-proxy ingress handling request routing, latency histograms, and upstream retry protection.",
    mappedService: "gateway",
  },
  "backend-service": {
    id: "backend-service",
    tierLabel: "Tier 03",
    name: "Backend Microservices",
    shortRole: "Orders · Payments · Telemetry Push",
    description:
      "Core domain microservices with 6-hour rolling push-on-break hooks that stream scrubbed incident bundles on error or latency breach.",
    mappedService: "orders",
  },
  "ai-engine": {
    id: "ai-engine",
    tierLabel: "Tier 04",
    name: "Patch-Up AI Engine",
    shortRole: "Gemini 3.5 Flash-Lite · Zero-Retention RAM",
    description:
      "Diagnoses root causes in seconds, ranks counterfactual mitigations, runs syntax & security self-gates, and purges volatile RAM immediately.",
  },
};

export function normalizeToTowerNode(id: string | null): TowerNodeId | null {
  if (!id) return null;
  if (id === "git-sep" || id === "github-service" || id === "layer-git-sep") return "git-sep";
  if (id === "frontend-service" || id === "layer-frontend") return "frontend-service";
  if (id === "gateway-service" || id === "layer-gateway") return "gateway-service";
  if (id === "ai-engine" || id === "gemini-brain" || id === "layer-ai-engine") return "ai-engine";
  return "backend-service";
}
