// Row shape shared by the live chain reader and the fixture fallback.
// Fixture rows carry null chain identifiers; live rows are fully populated.
export interface AgentRow {
    licenseId: number | null; // null = fixture row (no on-chain identity)
    name: string;
    address: string;
    principal: string | null; // gates the revoke action to the license holder
    licenseNo: string;
    capPerDay: number; // whole tUSDC per day, from HaetaePolicy
    venues: string[]; // display names of policy-allowed venues
    expiry: string; // display string; first " · " segment shows in the table
    expiryUnix: number | null;
    issuedBlock: number;
    scope: string | null; // decoded bytes32 scope tag
    status: "licensed" | "ghost";
}

// One entry in the global court record (the Ledger view). Live rows carry a
// real tx hash and agent address; fixture rows carry nulls — same convention
// as AgentRow's null chain identifiers.
export interface LedgerRow {
    kind: "licensed" | "revoked" | "verdict" | "executed" | "refused";
    label: string;
    detail: string;
    block: number;
    txHash: string | null; // null = fixture row (no on-chain tx)
    agent: string | null; // checksummed agent address (live rows only)
    agentName: string;
}
