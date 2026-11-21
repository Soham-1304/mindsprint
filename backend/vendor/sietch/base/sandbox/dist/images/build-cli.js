import { fileURLToPath } from "node:url";
import { createNodeRunners } from "../docker.js";
import { buildImage, parseBuildArgs } from "./build-image.js";
import { renderMarkers } from "./detonation/markers.js";
import { createDockerConfigSession } from "./docker-config-session.js";
/**
 * `node dist/images/build-cli.js <image|all> [--context colima-sietch]` builds the images in the Colima VM
 * and prints one `<image> <name@sha256:id>` line each. Developer tool only: it runs on the developer's
 * machine against the VM's Docker daemon and never runs package code.
 */
// The repository root, from `base/sandbox/dist/images/build-cli.js`.
const REPO_ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
/** The detonation image's marker scripts, rendered from the layout constants. */
const RENDER_MARKERS = renderMarkers;
async function main() {
    const args = parseBuildArgs(process.argv.slice(2));
    const session = await createDockerConfigSession(process.env);
    try {
        const { run } = createNodeRunners({ env: session.env });
        for (const image of args.images) {
            const built = await buildImage({
                run,
                context: args.context,
                image,
                repoRoot: REPO_ROOT,
                ...(image === "detonation" && RENDER_MARKERS !== undefined ? { renderMarkers: RENDER_MARKERS } : {}),
            });
            process.stdout.write(`${image} ${built.ref}\n`);
        }
        return 0;
    }
    finally {
        await session.dispose();
    }
}
main().then((code) => {
    process.exitCode = code;
}, (error) => {
    process.stderr.write(`build failed: ${error instanceof Error ? error.message : "unknown error"}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=build-cli.js.map