import type { DockerClient, forceRemove as ForceRemove } from "./docker.js";
import type { EgressNetwork } from "./docker-args.js";
import { type FetchStepDeps } from "./fetch-step.js";
import type { ScanSource } from "./runner.js";
/**
 * The registry `ScanSource` (sandbox mode): it runs the two-stage `fetchStep` behind the allow-only proxy and
 * adapts its result to what `runScan` needs. `fetchStep` force-removes its own fetch container per stage but
 * leaves the proxy and the fetch and egress networks; this adapter removes them in a `finally`, so the
 * runner's own cleanup only has to deal with the sandbox network and the sink and detonation containers.
 */
export interface RegistrySourceConfig {
    readonly images: {
        readonly fetch: string;
        readonly proxy: string;
    };
    /** The registry host, no scheme or port. Default `registry.npmjs.org`. */
    readonly registryHost: string;
    /** DNS servers the proxy resolves the registry with (the embedded resolver is unusable under gVisor). */
    readonly dnsServers: readonly string[];
    readonly egress: EgressNetwork;
}
export interface RegistrySourceDeps extends FetchStepDeps {
    readonly docker: DockerClient;
    /** Injected so a test can observe cleanup; defaults to the real `forceRemove`. */
    readonly forceRemove: typeof ForceRemove;
}
export declare function createRegistrySource(deps: RegistrySourceDeps, config: RegistrySourceConfig): ScanSource;
//# sourceMappingURL=registry-source.d.ts.map