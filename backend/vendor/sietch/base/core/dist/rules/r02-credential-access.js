import { Grouper } from "./types.js";
/**
 * R2: a package process reads a credential store, or links to one. Every name the path can be
 * reached by is checked: earlier symlinks, hard links, and /proc/<pid>/root aliases.
 */
export const r02CredentialAccess = {
    id: "R2",
    title: "Read a credential store",
    evaluate(ctx) {
        const g = new Grouper();
        for (const event of ctx.events) {
            if (!ctx.isPackageEvent(event))
                continue;
            const views = ctx.viewsOf(event);
            if (event.type === "file_read" && ctx.touchesCredentials(views.path)) {
                g.add(`read:${event.path}`, "High", `Read the credential store ${ctx.show(event.path)}${via(views.path?.all, event.path, ctx.show)}.`, event.seq);
            }
            if (event.type === "file_write" &&
                (event.op === "symlink" || event.op === "hardlink") &&
                ctx.touchesCredentials(views.target)) {
                const kind = event.op === "symlink" ? "symlink" : "hard link";
                g.add(`link:${event.target}`, "High", `Created a ${kind} at ${ctx.show(event.path)} pointing to the credential store ${ctx.show(event.target ?? "")}.`, event.seq);
            }
        }
        return g.drafts();
    },
};
/** " (reached as X)" when a view other than the recorded path matters. */
export function via(all, recorded, show) {
    const other = all?.find((p) => p !== recorded);
    return other === undefined ? "" : ` (reached as ${show(other)})`;
}
//# sourceMappingURL=r02-credential-access.js.map