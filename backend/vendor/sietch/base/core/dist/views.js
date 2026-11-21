// Every name a path can be reached by (security reviews SR-1, SR-2, SR-7).
//
// A recorded path such as "/tmp/g/workflows/x.yml" may really be "/work/app/.github/workflows/x.yml"
// if the package made /tmp/g a symlink earlier. "/tmp/d/../.npmrc" with /tmp/d -> /home/dev/sub is
// "/home/dev/.npmrc", because the kernel resolves the link before applying "..". And
// "/proc/self/root/home/dev/.npmrc" is "/home/dev/.npmrc".
//
// So paths are walked one raw segment at a time, as the kernel does: a link is expanded when its
// name is reached, and ".." applies to the expanded result. Both the link and the literal name are
// kept as views, because a link recorded earlier may have been removed since. Extra views can only
// add findings, never remove them, which is the fail-closed direction.
//
// Cost (SR-7): the walk uses persistent linked lists and a trie of link names, so each step is O(1)
// and nothing is copied per step. Work is charged against a per-path budget and a budget shared by
// the whole trace. When either runs out the result is marked incomplete; rules treat incomplete
// views as forbidden for writes, and R13 reports them, so exhausting the budget can never help a
// package get SAFE.
import { MAX_SYMLINK_HOPS } from "./limits.js";
import { segments } from "./paths.js";
/** Most views kept for one path. */
const MAX_VIEWS = 16;
/** Most links recorded per trace. More than this marks every later resolution incomplete. */
const MAX_LINKS = 10_000;
/** Work units allowed for one path: a few full walks per allowed hop. */
const perPathBudget = (segmentCount) => 64 + 4 * (segmentCount + 1) * (MAX_SYMLINK_HOPS + 1);
/** Work units allowed for the whole trace. A normal trace uses well under 1 % of this. */
export const TRACE_RESOLUTION_BUDGET = 4_000_000;
const newNode = () => ({ children: new Map(), targets: [] });
const toRest = (segs, tail) => {
    let rest = tail;
    for (let i = segs.length - 1; i >= 0; i--)
        rest = { seg: segs[i] ?? "", next: rest };
    return { rest, cost: segs.length };
};
export class LinkTable {
    root = newNode();
    total = 0;
    overflowed = false;
    budgetLeft = TRACE_RESOLUTION_BUDGET;
    homeSegs;
    projectSegs;
    constructor(home, projectDir) {
        this.homeSegs = segments(home);
        this.projectSegs = segments(projectDir);
    }
    /** Record that `linkPath` (absolute) is another name for `targetPath`. */
    add(linkPath, targetPath) {
        if (this.total >= MAX_LINKS) {
            this.overflowed = true;
            return;
        }
        let node = this.root;
        for (const seg of segments(linkPath)) {
            let next = node.children.get(seg);
            if (next === undefined) {
                next = newNode();
                node.children.set(seg, next);
            }
            node = next;
        }
        const target = segments(targetPath);
        const key = target.join("/");
        if (node.targets.some((t) => t.join("/") === key))
            return;
        node.targets.push(target);
        this.total++;
    }
    /** All views of a raw (not normalised) absolute path, given the links recorded so far. */
    views(rawPath) {
        const raw = rawPath.split("/").filter((s) => s !== "");
        const lexical = `/${segments(rawPath).join("/")}`;
        if (this.overflowed)
            return { all: [lexical], complete: false };
        if (raw[0] !== "proc" && this.missesEveryLink(raw))
            return { all: [lexical], complete: true };
        if (this.budgetLeft <= 0)
            return { all: [lexical], complete: false };
        const out = new Set([lexical]);
        let complete = true;
        let work = 0;
        const limit = Math.min(perPathBudget(raw.length), this.budgetLeft);
        const charge = (units) => {
            work += units;
            return work <= limit;
        };
        const start = toRest(raw, null);
        charge(start.cost);
        const stack = [{ done: null, rest: start.rest, hops: 0 }];
        while (stack.length > 0) {
            const state = stack.pop();
            if (state === undefined)
                break;
            if (!charge(1) || out.size > MAX_VIEWS) {
                complete = false;
                break;
            }
            const { done, rest, hops } = state;
            if (rest === null) {
                if (!charge(done?.depth ?? 0)) {
                    complete = false;
                    break;
                }
                out.add(render(done));
                continue;
            }
            if (rest.seg === ".") {
                stack.push({ done, rest: rest.next, hops });
                continue;
            }
            if (rest.seg === "..") {
                stack.push({ done: done?.parent ?? null, rest: rest.next, hops });
                continue;
            }
            const parentNode = done === null ? this.root : done.node;
            const node = parentNode?.children.get(rest.seg) ?? null;
            const next = { seg: rest.seg, node, parent: done, depth: (done?.depth ?? 0) + 1 };
            stack.push({ done: next, rest: rest.next, hops }); // the literal name
            for (const alias of this.procAlias(next)) {
                if (!charge(alias.cost)) {
                    complete = false;
                    break;
                }
                stack.push({ done: alias.done, rest: rest.next, hops });
            }
            if (!complete)
                break;
            if (node !== null && node.targets.length > 0) {
                if (hops >= MAX_SYMLINK_HOPS) {
                    complete = false;
                    continue;
                }
                for (const target of node.targets) {
                    const expanded = toRest(target, rest.next);
                    if (!charge(expanded.cost)) {
                        complete = false;
                        break;
                    }
                    stack.push({ done: null, rest: expanded.rest, hops: hops + 1 });
                }
                if (!complete)
                    break;
            }
        }
        this.budgetLeft -= work;
        return { all: [...out], complete };
    }
    /**
     * Fast path (SR-7): true when the path has no "." or ".." segments and no prefix of it is a
     * recorded link. Then the kernel would open exactly the lexical path, so there is nothing to
     * walk. This costs at most one Map lookup per segment until the path leaves the link trie,
     * which for ordinary paths is after the first segment or two.
     */
    missesEveryLink(raw) {
        let node = this.root;
        for (const seg of raw) {
            if (seg === "." || seg === "..")
                return false;
            if (node !== undefined) {
                node = node.children.get(seg);
                if (node !== undefined && node.targets.length > 0)
                    return false;
            }
        }
        return true;
    }
    /** Build a Done chain for absolute segments, following the link trie. */
    chain(segs) {
        return segs.reduce((parent, seg) => {
            const parentNode = parent === null ? this.root : parent.node;
            return { seg, node: parentNode?.children.get(seg) ?? null, parent, depth: (parent?.depth ?? 0) + 1 };
        }, null);
    }
    /** /proc/<p>/root and /proc/<p>/task/<t>/root are "/". /proc/<p>/cwd is likely home or the project. */
    procAlias(done) {
        if (done.depth !== 3 && done.depth !== 5)
            return [];
        if (done.seg !== "root" && done.seg !== "cwd")
            return [];
        const segs = [];
        for (let d = done; d !== null; d = d.parent)
            segs.unshift(d.seg);
        if (segs[0] !== "proc" || (done.depth === 5 && segs[2] !== "task"))
            return [];
        if (done.seg === "root")
            return [{ done: null, cost: 1 }];
        return [
            { done: this.chain(this.homeSegs), cost: this.homeSegs.length },
            { done: this.chain(this.projectSegs), cost: this.projectSegs.length },
        ];
    }
}
function render(done) {
    const segs = [];
    for (let d = done; d !== null; d = d.parent)
        segs.push(d.seg);
    return `/${segs.reverse().join("/")}`;
}
//# sourceMappingURL=views.js.map