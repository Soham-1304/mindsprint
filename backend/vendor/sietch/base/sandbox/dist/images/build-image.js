import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SietchError } from "@sietch/core";
import { isImageRef } from "../docker-args.js";
import { IMAGE_NAMES, IMAGE_TAG, imageRepository, isImageName } from "./image-spec.js";
import { stageImageContext } from "./stage.js";
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
export class ImageBuildError extends SietchError {
    constructor(message) {
        super("IMAGE_BUILD_FAILED", message);
    }
}
const CONTEXT_PATTERN = /^[a-z0-9][a-z0-9_.-]{0,63}$/;
const IMAGE_ID_PATTERN = /^sha256:[0-9a-f]{64}$/;
export const DEFAULT_BUILD_CONTEXT = "colima-sietch";
const BUILD_TIMEOUT_MS = 10 * 60_000;
const INSPECT_TIMEOUT_MS = 30_000;
const BUILD_MAX_STDOUT_BYTES = 4 * 1024 * 1024;
const BUILD_MAX_STDERR_BYTES = 4 * 1024 * 1024;
const INSPECT_MAX_BYTES = 4096;
const MESSAGE_TAIL_CHARS = 300;
const decoder = new TextDecoder();
const NODE_DEPS = {
    stage: stageImageContext,
    makeTempDir: () => mkdtemp(join(tmpdir(), "sietch-image-context-")),
    removeDir: (path) => rm(path, { recursive: true, force: true }),
};
/** Control characters become `?`, so the tail of Docker's own output can sit in an error message. */
function tail(bytes) {
    const text = decoder
        .decode(bytes)
        .replace(/[^\x20-\x7e\n]/g, "?")
        .trim();
    return text.slice(-MESSAGE_TAIL_CHARS);
}
function check(result, label) {
    if (result.timedOut)
        throw new ImageBuildError(`docker ${label} timed out`);
    if (result.overflowed)
        throw new ImageBuildError(`docker ${label} wrote more output than its limit`);
    if (result.code !== 0) {
        const how = result.code === null ? `signal ${result.signal ?? "unknown"}` : `exit ${result.code}`;
        const detail = tail(result.stderr);
        throw new ImageBuildError(`docker ${label} failed (${how})${detail === "" ? "" : `: ${detail}`}`);
    }
}
export async function buildImage(options) {
    const { run, context, image, repoRoot, renderMarkers } = options;
    if (typeof context !== "string" || !CONTEXT_PATTERN.test(context)) {
        throw new ImageBuildError("invalid docker context name");
    }
    if (!isImageName(image))
        throw new ImageBuildError("unknown image name");
    const deps = { ...NODE_DEPS, ...options.deps };
    const repository = imageRepository(image);
    const tag = `${repository}:${IMAGE_TAG}`;
    const directory = await deps.makeTempDir();
    try {
        await deps.stage({
            image,
            repoRoot,
            outDir: directory,
            ...(renderMarkers === undefined ? {} : { renderMarkers }),
        });
        check(await run("docker", [`--context=${context}`, "build", "--pull=false", "-t", tag, directory], {
            timeoutMs: BUILD_TIMEOUT_MS,
            maxStdoutBytes: BUILD_MAX_STDOUT_BYTES,
            maxStderrBytes: BUILD_MAX_STDERR_BYTES,
        }), "build");
    }
    finally {
        await deps.removeDir(directory);
    }
    const inspected = await run("docker", [`--context=${context}`, "image", "inspect", "--format={{.Id}}", tag], { timeoutMs: INSPECT_TIMEOUT_MS, maxStdoutBytes: INSPECT_MAX_BYTES, maxStderrBytes: INSPECT_MAX_BYTES });
    check(inspected, "image inspect");
    const id = decoder.decode(inspected.stdout).trim();
    if (!IMAGE_ID_PATTERN.test(id))
        throw new ImageBuildError("docker image inspect did not return an image id");
    const ref = `${repository}@${id}`;
    if (!isImageRef(ref))
        throw new ImageBuildError("the built image reference is not a digest-pinned reference");
    return { ref, id };
}
/** Parses `<image|all> [--context <name>]`. Throws `ImageBuildError` with a usage message. */
export function parseBuildArgs(argv) {
    const usage = `usage: build-cli <${IMAGE_NAMES.join("|")}|all> [--context <name>]`;
    let target;
    let context = DEFAULT_BUILD_CONTEXT;
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index] ?? "";
        if (arg === "--context") {
            const value = argv[index + 1];
            if (value === undefined)
                throw new ImageBuildError(usage);
            context = value;
            index += 1;
        }
        else if (arg.startsWith("--context=")) {
            context = arg.slice("--context=".length);
        }
        else if (arg.startsWith("-") || target !== undefined) {
            throw new ImageBuildError(usage);
        }
        else {
            target = arg;
        }
    }
    if (target === undefined)
        throw new ImageBuildError(usage);
    if (!CONTEXT_PATTERN.test(context))
        throw new ImageBuildError("invalid docker context name");
    if (target === "all")
        return { images: IMAGE_NAMES, context };
    if (!isImageName(target))
        throw new ImageBuildError(usage);
    return { images: [target], context };
}
//# sourceMappingURL=build-image.js.map