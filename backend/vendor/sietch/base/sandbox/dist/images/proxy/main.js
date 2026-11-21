import { Resolver } from "node:dns/promises";
import { PROXY_PORT } from "../../docker-args.js";
import { readProxyConfig } from "./config.js";
import { createProxyServer } from "./proxy-server.js";
/**
 * Entrypoint of the registry-proxy image. Reads `REGISTRY_HOST` and `DNS_SERVERS`, listens on
 * `PROXY_PORT`, and exits 1 with a fixed line on stderr when the configuration is invalid. Stdout
 * carries one JSON log line per event (fixed words only). The proxy resolves the registry name with the
 * given DNS servers, not the container resolver, which does not work under gVisor.
 */
const EXIT_BAD_CONFIG = 1;
const config = readProxyConfig(process.env);
if (config === null) {
    process.stderr.write("proxy: invalid configuration\n");
    process.exit(EXIT_BAD_CONFIG);
}
const resolver = new Resolver({ timeout: 3000, tries: 2 });
resolver.setServers([...config.dnsServers]);
const log = (event) => {
    process.stdout.write(`${JSON.stringify(event)}\n`);
};
const server = createProxyServer({
    registryHost: config.registryHost,
    resolver: { resolve4: (host) => resolver.resolve4(host) },
    log,
});
server.on("error", () => {
    process.stderr.write("proxy: server error\n");
    process.exit(EXIT_BAD_CONFIG);
});
server.listen(PROXY_PORT, "0.0.0.0", () => log({ ev: "listen" }));
process.on("SIGTERM", () => {
    server.close();
    process.exit(0);
});
//# sourceMappingURL=main.js.map