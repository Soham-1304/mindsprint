import { isInside } from "../paths.js";
import { ALTERNATIVE_RUNTIMES, programNames } from "../programs.js";
import { Grouper } from "./types.js";
const PRODUCES_CONTENT = new Set(["create", "write", "truncate", "chmod", "symlink", "hardlink"]);
/**
 * R4: running a file the package wrote outside node_modules during the scan, or running an
 * alternative JavaScript runtime. Shai-Hulud 2.0 installed and ran Bun to avoid Node-level hooks.
 * Downloading and running a binary inside node_modules (esbuild, sharp) is normal and not flagged.
 * Every name of each path is checked, so a symlink can't hide where a file really is.
 */
export const r04NewExecutable = {
    id: "R4",
    title: "Ran a new executable",
    evaluate(ctx) {
        const g = new Grouper();
        const written = new Map();
        const track = (paths, seq) => {
            for (const p of paths ?? [])
                if (!written.has(p))
                    written.set(p, seq);
        };
        for (const event of ctx.events) {
            if (!ctx.isPackageEvent(event))
                continue;
            const views = ctx.viewsOf(event);
            if (event.type === "file_write") {
                if (PRODUCES_CONTENT.has(event.op))
                    track(views.path?.all, event.seq);
                if (event.op === "rename")
                    track(views.target?.all, event.seq); // the content lands at the target
                continue;
            }
            if (event.type !== "exec")
                continue;
            const names = programNames(event, views.path);
            const runtime = names.find((n) => ALTERNATIVE_RUNTIMES.has(n));
            if (runtime !== undefined) {
                g.add(`runtime:${runtime}`, "High", `Ran the ${ctx.show(runtime)} runtime (${ctx.show(event.path)}), which can avoid Node-level monitoring.`, event.seq);
            }
            for (const p of views.path?.all ?? [event.path]) {
                const writeSeq = written.get(p);
                if (writeSeq === undefined || isInside(p, ctx.nodeModulesDir))
                    continue;
                const explanation = `Ran ${ctx.show(event.path)}, a file it wrote outside node_modules during the scan.`;
                g.add(`dropped:${event.path}`, "High", explanation, writeSeq);
                g.add(`dropped:${event.path}`, "High", explanation, event.seq);
                break;
            }
        }
        return g.drafts();
    },
};
//# sourceMappingURL=r04-new-executable.js.map