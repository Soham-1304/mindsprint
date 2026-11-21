import { segments } from "../paths.js";
import { via } from "./r02-credential-access.js";
import { Grouper } from "./types.js";
const VERB = {
    create: "Created",
    write: "Wrote to",
    truncate: "Truncated",
    delete: "Deleted",
    rename: "Moved",
    chmod: "Changed the permissions of",
    mkdir: "Created the directory",
    symlink: "Created a symlink at",
    hardlink: "Created a hard link at",
};
/** True if the path contains the directory pair ".github/workflows". */
export function isWorkflowPath(path) {
    const segs = segments(path);
    for (let i = 0; i + 1 < segs.length; i++)
        if (segs[i] === ".github" && segs[i + 1] === "workflows")
            return true;
    return false;
}
/**
 * R6: changes outside the package's own area. Planting a GitHub Actions workflow is Critical.
 * A write is allowed only if every name its path can be reached by is allowed, so a symlink from
 * /tmp into the home directory or the project doesn't make the write look harmless.
 */
export const r06OutsideWrite = {
    id: "R6",
    title: "Changed files outside its own area",
    evaluate(ctx) {
        const g = new Grouper();
        for (const event of ctx.events) {
            if (!ctx.isPackageEvent(event) || event.type !== "file_write")
                continue;
            const views = ctx.viewsOf(event);
            const checks = [
                [event.path, views.path, VERB[event.op]],
            ];
            if (event.op === "rename" && event.target !== undefined)
                checks.push([event.target, views.target, "Moved a file to"]);
            // A hard link to a file outside the allowed area gives the package a second way to change it.
            if (event.op === "hardlink" && event.target !== undefined)
                checks.push([event.target, views.target, "Created a hard link to"]);
            for (const [recorded, v, verb] of checks) {
                if (ctx.isAllowedWrite(v))
                    continue;
                const workflow = (v?.all ?? [recorded]).some(isWorkflowPath);
                const where = `${ctx.show(recorded)}${via(v?.all, recorded, ctx.show)}`;
                const explanation = v !== undefined && !v.complete
                    ? `${verb} ${where}, whose real location couldn't be worked out (a symlink loop or chain that is too long).`
                    : workflow
                        ? `${verb} ${where}: this plants a GitHub Actions workflow.`
                        : `${verb} ${where}, outside node_modules, temp, and cache directories.`;
                g.add(`write:${recorded}`, workflow ? "Critical" : "High", explanation, event.seq);
            }
        }
        return g.drafts();
    },
};
//# sourceMappingURL=r06-outside-write.js.map