import { validateScanInput } from "@sietch/core";
export function assembleScanInput(input) {
    if (input.profile.honeytokens.length === 0) {
        return { ok: false, code: "INVALID_SCAN_INPUT", reason: "the profile has no honeytokens" };
    }
    if (input.sinkAddresses.length === 0) {
        return { ok: false, code: "INVALID_SCAN_INPUT", reason: "there are no sink addresses" };
    }
    const candidate = {
        package: {
            name: input.package.name,
            version: input.package.version,
            integrity: input.package.integrity,
        },
        environment: {
            home: input.profile.home,
            projectDir: input.profile.projectDir,
            nodeModulesDir: input.profile.nodeModulesDir,
            tmpDirs: [...input.profile.tmpDirs],
            packageManagerPid: input.packageManagerPid,
            sinkAddresses: [...input.sinkAddresses],
            extraCredentialPaths: [...input.extraCredentialPaths],
        },
        allowlist: [...input.allowlist],
        honeytokens: input.profile.honeytokens.map(({ id, kind, value }) => ({ id, kind, value })),
        events: [...input.events],
        eventsTruncated: input.eventsTruncated,
    };
    const result = validateScanInput(candidate);
    if (!result.ok)
        return { ok: false, code: "INVALID_SCAN_INPUT", reason: result.reason };
    return { ok: true, scanInput: result.value };
}
//# sourceMappingURL=assemble.js.map