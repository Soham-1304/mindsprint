import { normaliseHost } from "../hosts.js";
import { NPM_REGISTRY_HOSTS, packageManagerCall, positional, programNames, REGISTRY_WRITE_COMMANDS, } from "../programs.js";
import { normaliseHttpPath } from "./http-path.js";
const TOKEN_PATHS = ["/-/npm/v1/tokens", "/-/whoami", "/-/user/"];
/**
 * R7: publishing, unpublishing, or using an npm token: how the worm spreads. Applies to every
 * event, the package manager's included.
 */
export const r07NpmRegistryWrite = {
    id: "R7",
    title: "Wrote to the npm registry",
    evaluate(ctx) {
        const drafts = [];
        for (const event of ctx.events) {
            if (event.type === "http") {
                const host = normaliseHost(event.host);
                if (host === null || !NPM_REGISTRY_HOSTS.has(host))
                    continue;
                const path = normaliseHttpPath(event.path);
                const write = event.method === "PUT" || event.method === "DELETE";
                if (write || TOKEN_PATHS.some((p) => path.startsWith(p))) {
                    drafts.push({
                        severity: "Critical",
                        explanation: `Sent ${event.method} ${ctx.show(event.path)} to ${host}: publishing, or using an npm token.`,
                        evidence: [event.seq],
                    });
                }
            }
            else if (event.type === "exec") {
                const call = packageManagerCall(event, programNames(event, ctx.viewsOf(event).path));
                if (call === null)
                    continue;
                const command = positional(call.args).find((a) => REGISTRY_WRITE_COMMANDS.has(a));
                if (command !== undefined) {
                    drafts.push({
                        severity: "Critical",
                        explanation: `Ran "${call.name} ${ctx.show(command)}", which publishes, changes, or logs in to the npm registry.`,
                        evidence: [event.seq],
                    });
                }
            }
        }
        return drafts;
    },
};
//# sourceMappingURL=r07-npm-registry-write.js.map