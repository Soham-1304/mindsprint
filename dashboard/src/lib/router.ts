export type ProjectTab = "overview" | "incidents" | "security" | "signals" | "settings";

export type AppRoute =
  | { kind: "projects" }
  | { kind: "project"; projectId: string; tab: ProjectTab; incidentId?: string };

export function parseRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/" || clean === "/projects") {
    return { kind: "projects" };
  }

  const parts = clean.split("/").filter(Boolean);
  if (parts[0] === "p" && parts[1]) {
    const projectId = decodeURIComponent(parts[1]);
    const section = parts[2];
    if (!section || section === "overview") {
      return { kind: "project", projectId, tab: "overview" };
    }
    if (section === "incidents") {
      return {
        kind: "project",
        projectId,
        tab: "incidents",
        incidentId: parts[3] ? decodeURIComponent(parts[3]) : undefined,
      };
    }
    if (section === "security" || section === "signals" || section === "settings") {
      return { kind: "project", projectId, tab: section };
    }
    return { kind: "project", projectId, tab: "overview" };
  }

  return { kind: "projects" };
}

export function buildPath(route: AppRoute): string {
  if (route.kind === "projects") return "/projects";
  const base = `/p/${encodeURIComponent(route.projectId)}`;
  if (route.tab === "overview") return base;
  if (route.tab === "incidents" && route.incidentId) {
    return `${base}/incidents/${encodeURIComponent(route.incidentId)}`;
  }
  return `${base}/${route.tab}`;
}
