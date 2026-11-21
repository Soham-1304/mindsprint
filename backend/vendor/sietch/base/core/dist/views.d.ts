export interface PathViews {
    /** Lexically normalised path first, then every other view, without duplicates. */
    readonly all: readonly string[];
    /** False when resolution ran out of budget, so some views may be missing. */
    readonly complete: boolean;
}
/** Work units allowed for the whole trace. A normal trace uses well under 1 % of this. */
export declare const TRACE_RESOLUTION_BUDGET = 4000000;
export declare class LinkTable {
    private readonly root;
    private total;
    private overflowed;
    private budgetLeft;
    private readonly homeSegs;
    private readonly projectSegs;
    constructor(home: string, projectDir: string);
    /** Record that `linkPath` (absolute) is another name for `targetPath`. */
    add(linkPath: string, targetPath: string): void;
    /** All views of a raw (not normalised) absolute path, given the links recorded so far. */
    views(rawPath: string): PathViews;
    /**
     * Fast path (SR-7): true when the path has no "." or ".." segments and no prefix of it is a
     * recorded link. Then the kernel would open exactly the lexical path, so there is nothing to
     * walk. This costs at most one Map lookup per segment until the path leaves the link trie,
     * which for ordinary paths is after the first segment or two.
     */
    private missesEveryLink;
    /** Build a Done chain for absolute segments, following the link trie. */
    private chain;
    /** /proc/<p>/root and /proc/<p>/task/<t>/root are "/". /proc/<p>/cwd is likely home or the project. */
    private procAlias;
}
//# sourceMappingURL=views.d.ts.map