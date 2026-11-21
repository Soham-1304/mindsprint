/**
 * The proxy's configuration, read from the two environment variables `docker-args.ts` sets
 * (`PROXY_ENV`). Both are checked again here: the container's environment is not a trust boundary
 * the proxy may skip. A missing or malformed value returns null and the proxy refuses to start.
 */
export interface ProxyConfig {
    readonly registryHost: string;
    readonly dnsServers: readonly string[];
}
export declare function readProxyConfig(env: Readonly<Record<string, string | undefined>>): ProxyConfig | null;
//# sourceMappingURL=config.d.ts.map