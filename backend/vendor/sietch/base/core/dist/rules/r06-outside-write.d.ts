import { type Rule } from "./types.js";
/** True if the path contains the directory pair ".github/workflows". */
export declare function isWorkflowPath(path: string): boolean;
/**
 * R6: changes outside the package's own area. Planting a GitHub Actions workflow is Critical.
 * A write is allowed only if every name its path can be reached by is allowed, so a symlink from
 * /tmp into the home directory or the project doesn't make the write look harmless.
 */
export declare const r06OutsideWrite: Rule;
//# sourceMappingURL=r06-outside-write.d.ts.map