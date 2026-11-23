import type { DashboardOverview } from "../types";

export const EMPTY_OVERVIEW: DashboardOverview = {
  monitoringMode: "push-ephemeral",
  activeProjectId: undefined,
  ephemeralStats: {
    activeBundles: 0,
    totalPurged: 0,
  },
  projects: [],
  projectServices: [],
  probeHistoryByProject: {},
  target: {
    name: "",
    activeRelease: "",
    canarySplit: {
      stable: 100,
      canary: 0,
      stableLabel: "",
      canaryLabel: "",
    },
    services: [],
  },
  scorecard: {
    meanTtdMs: 0,
    manualBaselineMs: 18 * 60 * 1000,
    incidentsTotal: 0,
    fixPrsOpened: 0,
    sietchPackagesBlocked: 0,
    pendingApprovals: 0,
  },
  incidents: [],
  approvals: [],
  auditLog: [],
  sietchScans: [],
  postmortems: [],
};
