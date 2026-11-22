export type LayerHealthState = "HEALTHY" | "DEGRADED" | "CRITICAL" | "RECOVERING" | "UNKNOWN";

export type TowerNodeId =
  | "git-sep"
  | "frontend-service"
  | "gateway-service"
  | "backend-service"
  | "ai-engine";

export interface RealTowerSlot {
  slotId: TowerNodeId;
  serviceKey: string;
  label: string;
  role: string;
  url?: string;
  health: LayerHealthState;
  errorRate5xx?: number;
  p95LatencyMs?: number;
  version?: string;
  lastCheckedAt?: string;
}

export function normalizeToTowerNode(rawId: string): TowerNodeId {
  switch (rawId) {
    case "git-sep":
    case "github-service":
    case "layer-git-sep":
      return "git-sep";
    case "frontend-service":
    case "layer-frontend":
      return "frontend-service";
    case "gateway-service":
    case "layer-gateway":
      return "gateway-service";
    case "backend-service":
    case "orders-service":
    case "payments-service":
    case "inventory-service":
    case "layer-backend":
      return "backend-service";
    case "ai-engine":
    case "gemini-brain":
    case "layer-ai-engine":
    default:
      return "ai-engine";
  }
}
