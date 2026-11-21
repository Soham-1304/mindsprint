import { networkRmArgs } from "./docker-args.js";
import { fetchStep } from "./fetch-step.js";
import { deriveNames } from "./scan-id.js";
export function createRegistrySource(deps, config) {
    return {
        kind: "registry",
        async fetch(request, scanId) {
            const names = deriveNames(scanId);
            try {
                const result = await fetchStep(deps, {
                    id: scanId,
                    images: config.images,
                    request: { name: request.name, version: request.version, integrity: request.integrity },
                    registryHost: config.registryHost,
                    dnsServers: config.dnsServers,
                    egress: config.egress,
                });
                if (!result.ok)
                    return { ok: false, code: result.code, reason: result.reason };
                return { ok: true, lockfile: result.lockfile, report: result.report, cacheTar: result.cacheTar };
            }
            finally {
                await deps.forceRemove(deps.docker, names.containers.proxy).catch(() => undefined);
                await deps.docker.exec(networkRmArgs(names.networks.fetch)).catch(() => undefined);
                await deps.docker.exec(networkRmArgs(names.networks.egress)).catch(() => undefined);
            }
        },
    };
}
//# sourceMappingURL=registry-source.js.map