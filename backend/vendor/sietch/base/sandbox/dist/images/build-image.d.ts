import { SietchError } from "@sietch/core";
import type { CommandRunner } from "../docker.js";
import { type ImageName } from "./image-spec.js";
import { type RenderMarkers, type StageOptions, type StageResult } from "./stage.js";
/**
 * Builds one image in the Docker daemon behind a docker context and returns the reference a run uses,
 * `<repository>@sha256:<image id>`. The context is staged by `stageImageContext` into a fresh temporary
 * directory (removed afterwards), then `docker build --pull=false` reads it, so nothing is pulled and
 * the base image must already be in the daemon. The docker calls go through the injected `CommandRunner`
 * (a real one from `createNodeRunners`, with the Sietch-owned `DOCKER_CONFIG`), with argument arrays and no
 * shell. Only this module and the VM test helpers build images; the runner itself never does.
 *
 * `docker build` and `docker image inspect` are not scan-container commands, so they don't go through
 * `assertSafeArgv`: both argument lists are built here from a checked context name and a fixed image name.
 */
export declare class ImageBuildError extends SietchError {
    constructor(message: string);
}
export declare const DEFAULT_BUILD_CONTEXT = "colima-sietch";
export interface BuildDeps {
    readonly stage: (options: StageOptions) => Promise<StageResult>;
    /** Makes a fresh empty directory and returns its absolute path. */
    readonly makeTempDir: () => Promise<string>;
    readonly removeDir: (path: string) => Promise<void>;
}
export interface BuildImageOptions {
    readonly run: CommandRunner;
    /** A docker context name such as `colima-sietch`. */
    readonly context: string;
    readonly image: ImageName;
    readonly repoRoot: string;
    /** Required when `image` is `detonation`. */
    readonly renderMarkers?: RenderMarkers;
    readonly deps?: Partial<BuildDeps>;
}
export interface BuiltImage {
    /** `<repository>@sha256:<id>`: accepted by `isImageRef`, the only form a run uses. */
    readonly ref: string;
    /** `sha256:<id>`. */
    readonly id: string;
}
export declare function buildImage(options: BuildImageOptions): Promise<BuiltImage>;
export interface BuildArgs {
    readonly images: readonly ImageName[];
    readonly context: string;
}
/** Parses `<image|all> [--context <name>]`. Throws `ImageBuildError` with a usage message. */
export declare function parseBuildArgs(argv: readonly string[]): BuildArgs;
//# sourceMappingURL=build-image.d.ts.map