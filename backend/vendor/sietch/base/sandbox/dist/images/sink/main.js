import { systemCaDeps } from "../../ca.js";
import { EXIT_INTERNAL, runSink } from "./run.js";
/**
 * The capture sink's entrypoint. Reads the CA material from stdin (three frames, see `config.ts`), binds
 * UDP 53, TCP 53, TCP 80 and TCP 443, and writes one JSON record per line to stdout until it gets SIGTERM.
 * Then it ends the open connections, writes the end record and exits 0. Stdout carries only records. Stderr
 * carries one fixed line, never any input or key text. See `run.ts` for the exit codes.
 */
const result = await runSink({
    stdin: process.stdin,
    write: (line) => void process.stdout.write(line),
    now: () => Date.now(),
    caDeps: systemCaDeps(),
    bindAddress: "0.0.0.0",
    ports: { dnsUdp: 53, dnsTcp: 53, http: 80, https: 443 },
});
if (!result.ok) {
    process.stderr.write(`${result.message}\n`);
    process.exit(result.exitCode);
}
let stopping = false;
const stop = () => {
    if (stopping)
        return;
    stopping = true;
    result.stop().then(
    // Exit only after stdout has taken the last line.
    () => process.stdout.write("", () => process.exit(0)), () => process.exit(EXIT_INTERNAL));
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
//# sourceMappingURL=main.js.map