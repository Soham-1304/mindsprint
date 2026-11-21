import { startDnsRelay } from "./dns-relay.js";
import { DNS_PORT, RELAY_LISTEN_ADDRESS, RELAY_READY_LINE } from "./layout.js";
/**
 * The relay's process: `node relay-main.js <sink IPv4 address>`. It binds UDP and TCP on 127.0.0.11:53,
 * prints `ready` after both binds, and exits 0 on SIGTERM. Init starts it and waits for the `ready` line
 * before it starts install. Stdout carries that one line only. Stderr carries fixed text only.
 */
const IPV4 = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
async function main() {
    const upstream = process.argv[2];
    if (process.argv.length !== 3 || upstream === undefined || !IPV4.test(upstream)) {
        process.stderr.write("relay: a sink address is required\n");
        return 1;
    }
    let relay;
    try {
        relay = await startDnsRelay({
            listenAddress: RELAY_LISTEN_ADDRESS,
            listenPort: DNS_PORT,
            upstreamAddress: upstream,
            upstreamPort: DNS_PORT,
        });
    }
    catch {
        process.stderr.write("relay: could not bind\n");
        return 1;
    }
    process.once("SIGTERM", () => {
        relay.close().then(() => process.exit(0), () => process.exit(1));
    });
    process.stdout.write(`${RELAY_READY_LINE}\n`);
    return -1;
}
main().then((code) => {
    if (code >= 0)
        process.exit(code);
});
//# sourceMappingURL=relay-main.js.map