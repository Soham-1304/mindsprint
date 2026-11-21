import { type Rule } from "./types.js";
/**
 * R3: contact with a host or address that isn't the capture sink, loopback, or allowlisted. A
 * connection to the sink on a port it doesn't record (anything but DNS, HTTP, HTTPS) is flagged
 * too: its payload would be invisible to R1 (security review SR-3).
 */
export declare const r03UnexpectedDestination: Rule;
//# sourceMappingURL=r03-unexpected-destination.d.ts.map