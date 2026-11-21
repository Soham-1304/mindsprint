import type { RenderedMarkers } from "../stage.js";
/**
 * The two marker scripts the detonation image runs (design D13). The trace normaliser tells the install
 * role from the load role by the first `execve` of a direct child of init: `/opt/runner/install` and
 * `/opt/runner/load`. Each script `exec`s its real program, so the shell is replaced and the marker is
 * one exec in the trace, followed by npm or node.
 *
 * Both are rendered from constants, not written by hand: the shell flag is the one `script-report.ts`
 * checks the trace against, and the paths are the layout's, so the script and the check can't drift.
 *
 * Host side only. The build driver calls it while staging the image context; it is not in the image.
 *
 * `--dangerously-allow-all-scripts`: from npm 12 install scripts are opt-in, and a scan that silently
 * skipped them would look clean. The flag keeps the behaviour the scan is about independent of the npm
 * version in the base image (spike 5). `--offline` plus `--cache` means npm reads only the delivered cache.
 */
export declare const INSTALL_ARGS: readonly string[];
export declare const renderMarkers: () => RenderedMarkers;
//# sourceMappingURL=markers.d.ts.map