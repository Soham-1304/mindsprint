import { normaliseHost } from "../hosts.js";
import { argsOf, GITHUB_HOSTS, positional, programNames, WRITE_METHODS } from "../programs.js";
import { normaliseHttpPath } from "./http-path.js";
/**
 * R8: creating repositories, workflows, or runners on GitHub, pushing code, or checking a GitHub
 * token. Shai-Hulud did all of these. Applies to every event.
 */
export const r08GithubWrite = {
    id: "R8",
    title: "Changed something on GitHub",
    evaluate(ctx) {
        const drafts = [];
        for (const event of ctx.events) {
            if (event.type === "http") {
                const host = normaliseHost(event.host);
                if (host === null || !GITHUB_HOSTS.has(host))
                    continue;
                const path = normaliseHttpPath(event.path);
                if (WRITE_METHODS.has(event.method) && !path.endsWith("/git-upload-pack")) {
                    drafts.push({
                        severity: "Critical",
                        explanation: `Sent ${event.method} ${ctx.show(event.path)} to ${host}: creating or changing something on GitHub.`,
                        evidence: [event.seq],
                    });
                }
                else if (host === "api.github.com" && (path === "/user" || path.startsWith("/user/"))) {
                    drafts.push({
                        severity: "High",
                        explanation: `Requested ${ctx.show(event.path)} from api.github.com, which checks whose GitHub token it holds.`,
                        evidence: [event.seq],
                    });
                }
            }
            else if (event.type === "exec") {
                const names = programNames(event, ctx.viewsOf(event).path);
                if (names.includes("git") && positional(argsOf(event, names)).includes("push")) {
                    drafts.push({ severity: "Critical", explanation: "Ran git push.", evidence: [event.seq] });
                }
                else if (names.includes("gh")) {
                    drafts.push({
                        severity: "High",
                        explanation: `Ran the GitHub CLI (${ctx.show(event.path)}).`,
                        evidence: [event.seq],
                    });
                }
            }
        }
        return drafts;
    },
};
//# sourceMappingURL=r08-github-write.js.map