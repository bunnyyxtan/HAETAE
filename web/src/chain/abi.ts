import { parseAbi, parseAbiItem, toFunctionSelector } from "viem";

// Hand-written minimal surfaces, mirrored from contracts/src (the deployed,
// Blockscout-verified sources). Errors ride along so viem can decode custom
// revert reasons during simulation into readable messages.
export const licenseAbi = parseAbi([
    "function totalSupply() view returns (uint256)",
    "function tokenByIndex(uint256 index) view returns (uint256)",
    "function licenseById(uint256 id) view returns ((address principal, address agent, uint64 expiry, bytes32 scope, uint8 status))",
    "function revoke(address agent)",
    "error NotLicensed()",
    "error NotAuthorized()",
    "error AlreadyRevoked()",
]);

export const policyAbi = parseAbi([
    "function capPerDay(address agent, address token) view returns (uint256)",
    "function remainingToday(address agent, address token) view returns (uint256)",
    "function isVenueAllowed(address agent, address venue) view returns (bool)",
]);

export const licensedEvent = parseAbiItem(
    "event Licensed(uint256 indexed licenseId, address indexed principal, address indexed agent, uint64 expiry, bytes32 scope)",
);
export const revokedEvent = parseAbiItem(
    "event Revoked(uint256 indexed licenseId, address indexed agent, address indexed revoker)",
);
export const sentinelVerdictEvent = parseAbiItem(
    "event SentinelVerdict(address indexed agent, address indexed watcher, bytes32 reasonHash)",
);
export const tradeExecutedEvent = parseAbiItem(
    "event TradeExecuted(address indexed agent, address indexed venue, address indexed token, uint256 amount)",
);
export const tradeRefusedEvent = parseAbiItem(
    "event TradeRefused(address indexed agent, address indexed venue, address indexed token, uint256 amount, bytes4 selector)",
);

// TradeRefused carries the gate's verdict as a raw 4-byte custom-error
// selector. Selector -> name, computed from the source error signatures at
// module init (no hardcoded hex to drift).
const errorSignatures = [
    "NotLicensed()",
    "LicenseExpired()",
    "LicenseNotActive()",
    "CapExceeded()",
    "SpendExceedsRemaining()",
    "VenueNotAllowed()",
    "NotAuthorizedCaller()",
    "NotAuthorized()",
    "AlreadyRevoked()",
    "AlreadyLicensed(address)",
    "NotVerified(address)",
    "NotPrincipal()",
    "NotGate()",
    "InvalidExpiry()",
] as const;

const selectorNames = new Map<string, string>(
    errorSignatures.map((sig) => [
        toFunctionSelector(sig).toLowerCase(),
        sig.replace(/\(.*$/, ""),
    ]),
);

export function verdictName(selector: string): string {
    return selectorNames.get(selector.toLowerCase()) ?? selector;
}
