import { r01HoneytokenExfil } from "./r01-honeytoken-exfil.js";
import { r02CredentialAccess } from "./r02-credential-access.js";
import { r03UnexpectedDestination } from "./r03-unexpected-destination.js";
import { r04NewExecutable } from "./r04-new-executable.js";
import { r05NetworkTool } from "./r05-network-tool.js";
import { r06OutsideWrite } from "./r06-outside-write.js";
import { r07NpmRegistryWrite } from "./r07-npm-registry-write.js";
import { r08GithubWrite } from "./r08-github-write.js";
import { r09Wiper } from "./r09-wiper.js";
import { r10LingeringProcess } from "./r10-lingering-process.js";
import { r13TruncatedTrace } from "./r13-truncated-trace.js";
/** Every rule, in the fixed order findings are reported in. */
export const RULES = [
    r01HoneytokenExfil,
    r02CredentialAccess,
    r03UnexpectedDestination,
    r04NewExecutable,
    r05NetworkTool,
    r06OutsideWrite,
    r07NpmRegistryWrite,
    r08GithubWrite,
    r09Wiper,
    r10LingeringProcess,
    r13TruncatedTrace,
];
export const RULE_ORDER = RULES.map((r) => r.id);
//# sourceMappingURL=index.js.map