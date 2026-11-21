import { type ChildEnv } from "../docker.js";
/**
 * A throwaway, Sietch-owned `DOCKER_CONFIG` for tools that drive the Docker CLI from a developer machine
 * (the image build CLI and the VM tests). It holds an empty `config.json` and links to the user's
 * `contexts` (so `colima-sietch` resolves) and, when present, `cli-plugins` (so `docker build` can find
 * buildx). `~/.docker/config.json` is never read, so a `proxies` block there can't add variables to a
 * container. The directory is made with `mkdtemp`, checked with `verifyDockerConfigDir`, and removed by
 * `dispose`.
 */
export interface DockerConfigSession {
    readonly dir: string;
    /** The child environment to give `createNodeRunners`. */
    readonly env: ChildEnv;
    dispose(): Promise<void>;
}
export declare function createDockerConfigSession(source: Readonly<Record<string, string | undefined>>, tempRoot?: string): Promise<DockerConfigSession>;
//# sourceMappingURL=docker-config-session.d.ts.map