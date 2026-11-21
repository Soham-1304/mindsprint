import { isDnsServerList, isRegistryHost, PROXY_ENV } from "../../docker-args.js";
import { parseIPv4Strict } from "./ip-class.js";
export function readProxyConfig(env) {
    const registryHost = env[PROXY_ENV.registryHost];
    const servers = env[PROXY_ENV.dnsServers];
    if (typeof registryHost !== "string" || typeof servers !== "string")
        return null;
    if (!isRegistryHost(registryHost) || parseIPv4Strict(registryHost) !== null)
        return null;
    const labels = registryHost.split(".");
    // A name with no dot, or whose last label is all digits, is not a registry host name.
    if (labels.length < 2 || /^\d+$/.test(labels[labels.length - 1] ?? ""))
        return null;
    const dnsServers = servers.split(",");
    if (!isDnsServerList(dnsServers))
        return null;
    return { registryHost, dnsServers };
}
//# sourceMappingURL=config.js.map