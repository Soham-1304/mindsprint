import { lstat, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { minimalChildEnv, verifyDockerConfigDir } from "../docker.js";
async function exists(path) {
    return await lstat(path).then(() => true, () => false);
}
export async function createDockerConfigSession(source, tempRoot = tmpdir()) {
    const home = source.HOME;
    if (typeof home !== "string" || home.length === 0) {
        throw new TypeError("HOME is required to find the docker contexts");
    }
    const dir = await mkdtemp(join(tempRoot, "sietch-docker-config-"));
    const dispose = async () => {
        // `rm` removes the links themselves, not the directories they point to.
        await rm(dir, { recursive: true, force: true });
    };
    try {
        await writeFile(join(dir, "config.json"), "{}\n", { mode: 0o600 });
        await symlink(join(home, ".docker", "contexts"), join(dir, "contexts"));
        const plugins = join(home, ".docker", "cli-plugins");
        if (await exists(plugins))
            await symlink(plugins, join(dir, "cli-plugins"));
        await verifyDockerConfigDir(dir, home);
        return { dir, env: minimalChildEnv(source, dir), dispose };
    }
    catch (error) {
        await dispose();
        throw error;
    }
}
//# sourceMappingURL=docker-config-session.js.map