import { argsOf, NETWORK_TOOLS, programNames } from "../programs.js";
import { Grouper } from "./types.js";
/** R5: running a network or DNS tool, the usual channel for shell-script exfiltration. */
export const r05NetworkTool = {
    id: "R5",
    title: "Ran a network tool",
    evaluate(ctx) {
        const g = new Grouper();
        for (const event of ctx.events) {
            if (!ctx.isPackageEvent(event) || event.type !== "exec")
                continue;
            const names = programNames(event, ctx.viewsOf(event).path);
            let tool = names.find((n) => NETWORK_TOOLS.has(n));
            if (tool === undefined && names.includes("openssl") && argsOf(event, names).includes("s_client"))
                tool = "openssl s_client";
            if (tool !== undefined)
                g.add(`tool:${tool}`, "High", `Ran the network tool ${ctx.show(tool)} (${ctx.show(event.path)}).`, event.seq);
        }
        return g.drafts();
    },
};
//# sourceMappingURL=r05-network-tool.js.map