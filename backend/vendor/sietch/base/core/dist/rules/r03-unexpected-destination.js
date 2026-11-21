import { canonicalIp, isLoopback, matchesAllowlist, normaliseHost } from "../hosts.js";
import { SINK_RECORDED_PORTS } from "../limits.js";
import { Grouper } from "./types.js";
/**
 * R3: contact with a host or address that isn't the capture sink, loopback, or allowlisted. A
 * connection to the sink on a port it doesn't record (anything but DNS, HTTP, HTTPS) is flagged
 * too: its payload would be invisible to R1 (security review SR-3).
 */
export const r03UnexpectedDestination = {
    id: "R3",
    title: "Contacted an unexpected host",
    evaluate(ctx) {
        const g = new Grouper();
        for (const event of ctx.events) {
            if (!ctx.isPackageEvent(event))
                continue;
            if (event.type === "dns" || event.type === "http") {
                const raw = event.type === "dns" ? event.name : event.host;
                const host = normaliseHost(raw);
                if (matchesAllowlist(ctx.allowlist, host))
                    continue;
                g.add(`host:${host ?? raw}`, "High", `Contacted ${ctx.show(host ?? raw)}, which is not on the allowlist.`, event.seq);
            }
            else if (event.type === "connect") {
                if (event.address === null) {
                    g.add("ip:unrecorded", "High", `Sent ${event.protocol} data to an address the recorder couldn't see, so where it went is unknown.`, event.seq);
                    continue;
                }
                const ip = canonicalIp(event.address);
                if (ip !== null && isLoopback(ip))
                    continue;
                if (ip !== null && ctx.sinkAddresses.has(ip)) {
                    if (event.protocol === "tcp" && SINK_RECORDED_PORTS.has(event.port))
                        continue;
                    if (event.protocol === "udp" && event.port === 53)
                        continue;
                    g.add(`sinkport:${event.protocol}:${event.port}`, "High", `Connected to ${event.protocol} port ${event.port}, where the capture sink can't record what was sent.`, event.seq);
                    continue;
                }
                if (ip !== null && matchesAllowlist(ctx.allowlist, ip))
                    continue;
                g.add(`ip:${ip ?? event.address}`, "High", `Connected directly to ${ctx.show(ip ?? event.address)} (${event.protocol} port ${event.port}), bypassing DNS and the capture sink.`, event.seq);
            }
        }
        return g.drafts();
    },
};
//# sourceMappingURL=r03-unexpected-destination.js.map