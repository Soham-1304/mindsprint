import { type DockerClient } from "./docker.js";
import { type EgressNetwork } from "./docker-args.js";
import { type RandomBytes } from "./scan-id.js";
/**
 * The host self-check (design D14, Requirement 2.10): proves, on the machine that will scan, that a
 * container on a per-scan internal network cannot reach the host's own services.
 *
 * HOST ASSUMPTION (not created here): the deploy spec installs an `INPUT` drop rule for the reserved
 * per-scan range `10.240.0.0/12`, and keeps it across reboots and Colima restarts. A `DOCKER-USER` rule
 * does not stop traffic to the bridge gateway address, because that traffic is addressed to the host and
 * goes through `INPUT` (spike 4, question 4). Host services must also listen on `127.0.0.1` or a Unix
 * socket only. This check finds a missing rule; it does not install one.
 *
 * For each of the two internal networks a scan uses (sandbox and fetch), and for the egress network (which
 * the caller must give, or declare absent with `noProxy: true`), it creates the network with the same builder a scan uses, runs one probe container
 * under gVisor with the probe script on stdin, and removes the container and the network afterwards, on
 * every path. The probe tries TCP to the gateway address on several ports, to the cloud metadata address,
 * and to any extra host addresses. On the egress network it also tries the Lima host (192.168.5.2) and one
 * other private address, which must time out too. It also opens a listener of its own and connects to it (the positive
 * control).
 *
 * Before any network is created, it runs `checkRuntimes` (see `runtime-check.ts`): the daemon's
 * `runsc-trace-min` runtime must trace exactly the syscalls the rules engine expects.
 *
 * After each probe it removes the container and the network. A removal that fails (other than "already
 * gone") makes the result `HOST_EXPOSED` with a constant label, because a leftover egress bridge has a
 * route out.
 *
 * Pass rule, per probe:
 * - the control must CONNECT. If it can't, the probe's own networking is broken, and a probe that can't
 *   connect anywhere would otherwise look like a protected host;
 * - the gateway must TIME OUT. A refusal proves the host answered, and a connection is a breach;
 * - every other target must time out or be unreachable (an internal network has no route to it).
 * Every other result, a missing or repeated probe line, malformed or oversized output, a probe that
 * cannot run, and any Docker failure is `HOST_EXPOSED`. The caller must refuse to scan on `HOST_EXPOSED`.
 *
 * Known gaps: only TCP is probed (UDP services on the gateway, such as DNS or NTP, are not). The check
 * is a point-in-time test. A later firewall flush, Docker or Colima restart, or reboot without a
 * persistent rule removes the protection, so the caller must run it again before each batch of scans
 * (or on a timer), not only at start-up.
 */
export type SelfCheckResult = {
    ok: true;
} | {
    ok: false;
    code: "HOST_EXPOSED";
    reason: string;
};
export interface SelfCheckDeps {
    /** Only `exec` and `hostArchitecture` (for the daemon runtime check) are used. */
    readonly docker: Pick<DockerClient, "exec" | "hostArchitecture">;
    readonly randomBytes: RandomBytes;
    /** A digest-pinned image that contains `node`. */
    readonly probeImage: string;
    /** Other addresses of this host to probe (for example its LAN address). Strict IPv4, at most 8. */
    readonly extraHostAddresses?: readonly string[];
    /**
     * The proxy's egress network, when the deployment uses one. It has a route out, and it is outside the
     * per-scan range, so the `INPUT` rule for `10.240.0.0/12` does not cover it. When given, the check also
     * creates it, runs a probe on it, and requires the same result: the gateway (the host) must not
     * answer, and the metadata address and the private addresses below must not be reachable. Deploy must
     * drop all of them for this to pass.
     *
     * Required unless `noProxy` is `true`: leaving it out must never silently skip the egress probe.
     */
    readonly egress?: EgressNetwork;
    /**
     * Set to `true` only when this deployment has no proxy and so no egress network. With neither `egress`
     * nor `noProxy: true` the check refuses (`HOST_EXPOSED`), and passing both is refused as a
     * contradiction.
     */
    readonly noProxy?: boolean;
}
export declare const PROBE_PORTS: readonly number[];
export declare const METADATA_ADDRESS = "169.254.169.254";
/**
 * The Colima (Lima) host as the VM sees it: the default gateway, which forwards to the Mac. The egress
 * network has a route out, so only a `DOCKER-USER` drop for private ranges keeps the proxy from it.
 */
export declare const LIMA_HOST_ADDRESS = "192.168.5.2";
/**
 * One other private (RFC 1918) address, the QEMU user-mode host gateway. A tripwire for the egress
 * network's drop of private ranges; a deployment adds the addresses of its own neighbours (the cloud
 * VPC gateway, for example) through `extraHostAddresses`.
 */
export declare const PRIVATE_PROBE_ADDRESS = "10.0.2.2";
/** Output cap on the probe container (Task 6). One line is about 30 bytes. */
export declare const PROBE_MAX_OUTPUT_BYTES: number;
/** Run once per host at startup. `HOST_EXPOSED` means: do not scan. */
export declare function selfCheck(deps: SelfCheckDeps): Promise<SelfCheckResult>;
//# sourceMappingURL=self-check.d.ts.map