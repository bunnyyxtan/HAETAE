import type { AgentRow, LedgerRow } from "../chain/types";

// The console's row type is the shared AgentRow; fixture rows are the S02
// dataset with null chain identifiers (no licenseId/principal — fixture mode
// never signs anything).
export type AgentLicense = AgentRow;

// Staged-load delay is URL-tunable in fixture mode (?demo=fixtures&delay=0)
// so demo rehearsals and screenshot evidence can skip the skeleton theater.
// Absent or invalid → the default 900ms stays. Other flags remain edit-here
// rehearsal knobs by design.
const rawDelay = new URLSearchParams(window.location.search).get("delay");
const parsedDelay = rawDelay === null || rawDelay === "" ? NaN : Number(rawDelay);

export const flags = {
    forceEmpty: false,
    forceError: false,
    rejectWallet: "rabby",
    loadDelayMs: Number.isFinite(parsedDelay) && parsedDelay >= 0 ? parsedDelay : 900
};

interface FixtureSeed {
    name: string;
    address: string;
    licenseNo: string;
    capPerDay: number;
    venues: string[];
    expiry: string;
    issuedBlock: number;
    status: "licensed" | "ghost";
}

const seeds: FixtureSeed[] = [
    {
        name: "Arbitrage Alpha",
        address: "0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B",
        licenseNo: "HT-0001",
        capPerDay: 50000,
        venues: ["Uniswap V3", "Curve"],
        expiry: "8800000 · 2026-12-01",
        issuedBlock: 8300000,
        status: "licensed"
    },
    {
        name: "Liquidity Sentinel",
        address: "0x2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C",
        licenseNo: "HT-0002",
        capPerDay: 100000,
        venues: ["Aave", "Balancer"],
        expiry: "8900000 · 2027-01-15",
        issuedBlock: 8310000,
        status: "licensed"
    },
    {
        name: "Flash-Mint Oracle",
        address: "0x3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D",
        licenseNo: "HT-0003",
        capPerDay: 15000,
        venues: ["MakerDAO"],
        expiry: "8700000 · 2026-09-30",
        issuedBlock: 8350000,
        status: "ghost"
    },
    {
        name: "Yield Harvester X",
        address: "0x4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E",
        licenseNo: "HT-0004",
        capPerDay: 25000,
        venues: ["Compound", "Morpho"],
        expiry: "9000000 · 2027-04-01",
        issuedBlock: 8360000,
        status: "licensed"
    },
    {
        name: "Peg Defender",
        address: "0x5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F",
        licenseNo: "HT-0005",
        capPerDay: 200000,
        venues: ["Frax", "Curve"],
        expiry: "9100000 · 2027-06-20",
        issuedBlock: 8380000,
        status: "licensed"
    },
    {
        name: "Rogue Trader v1",
        address: "0x6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A",
        licenseNo: "HT-0006",
        capPerDay: 10000,
        venues: ["Sushiswap"],
        expiry: "8600000 · 2026-05-12",
        issuedBlock: 8390000,
        status: "ghost"
    },
    {
        name: "Treasury Keeper",
        address: "0x7A8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B",
        licenseNo: "HT-0007",
        capPerDay: 500000,
        venues: ["Lido", "Spark"],
        expiry: "9200000 · 2027-09-10",
        issuedBlock: 8400000,
        status: "licensed"
    },
    {
        name: "Frontrun Bot 99",
        address: "0x8B9C0D1E2F3A4B5C6D7E8F9A0B1C2D3E4F5A6B7C",
        licenseNo: "HT-0008",
        capPerDay: 5000,
        venues: ["Uniswap V2"],
        expiry: "8500000 · 2026-03-01",
        issuedBlock: 8405000,
        status: "ghost"
    }
];

export const agentFixtures: AgentLicense[] = seeds.map((s) => ({
    ...s,
    licenseId: null,
    principal: null,
    expiryUnix: null,
    scope: null
}));

export const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
};

// The Ledger view's fixture record: hand-authored, deterministic, consistent
// with the seeds above (names, issued blocks, ghost endings). txHash/agent
// are null — fixture rows never reference real transactions, same convention
// as the null chain identifiers on fixture agent rows.
const lf = (
    kind: LedgerRow["kind"],
    label: string,
    agentName: string,
    detail: string,
    block: number,
): LedgerRow => ({ kind, label, detail, block, txHash: null, agent: null, agentName });

export const ledgerFixtures: LedgerRow[] = [
    lf("licensed", "Licensed", "Arbitrage Alpha", "HT-0001", 8300000),
    lf("licensed", "Licensed", "Liquidity Sentinel", "HT-0002", 8310000),
    lf("licensed", "Licensed", "Flash-Mint Oracle", "HT-0003", 8350000),
    lf("licensed", "Licensed", "Yield Harvester X", "HT-0004", 8360000),
    lf("executed", "Trade Executed", "Arbitrage Alpha", "12,400 tUSDC → Uniswap V3", 8365210),
    lf("licensed", "Licensed", "Peg Defender", "HT-0005", 8380000),
    lf("verdict", "Sentinel Verdict", "Flash-Mint Oracle", "reason 0x7f3a99c2…", 8383760),
    lf("revoked", "Revoked", "Flash-Mint Oracle", "by Sentinel Authority", 8383761),
    lf("licensed", "Licensed", "Rogue Trader v1", "HT-0006", 8390000),
    lf("executed", "Trade Executed", "Arbitrage Alpha", "8,900 tUSDC → Curve", 8391402),
    lf("refused", "Trade Refused", "Rogue Trader v1", "CapExceeded · 18,000 tUSDC → Sushiswap", 8397404),
    lf("verdict", "Sentinel Verdict", "Rogue Trader v1", "reason 0x2c81aa10…", 8397405),
    lf("revoked", "Revoked", "Rogue Trader v1", "by Sentinel Authority", 8397406),
    lf("licensed", "Licensed", "Treasury Keeper", "HT-0007", 8400000),
    lf("executed", "Trade Executed", "Liquidity Sentinel", "41,000 tUSDC → Aave", 8402117),
    lf("licensed", "Licensed", "Frontrun Bot 99", "HT-0008", 8405000),
    lf("executed", "Trade Executed", "Peg Defender", "120,000 tUSDC → Curve", 8408852),
    lf("refused", "Trade Refused", "Frontrun Bot 99", "VenueNotAllowed · 900 tUSDC → Uniswap V2", 8409911),
    lf("revoked", "Revoked", "Frontrun Bot 99", "by principal", 8410007),
    lf("executed", "Trade Executed", "Treasury Keeper", "250,000 tUSDC → Lido", 8410233),
];
