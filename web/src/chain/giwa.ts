import { createPublicClient, defineChain, http } from "viem";
import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { CHAIN_ID, EXPLORER, RPC_URL } from "./deployment";

export const giwaSepolia = defineChain({
    id: CHAIN_ID,
    name: "GIWA Sepolia",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
    blockExplorers: { default: { name: "GIWA Blockscout", url: EXPLORER } },
    // Without this declaration viem SILENTLY skips multicall aggregation and
    // falls back to one eth_call per read — the batching below only works
    // because the canonical multicall3 preinstall is registered here
    // (bytecode re-verified on GIWA Sepolia at this address).
    contracts: {
        multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" },
    },
    testnet: true,
});

// Request-rate discipline: the public GIWA RPC rate-limits bursts, and every
// 429 the browser sees lands in the console as a network error (unsuppressible
// from JS). Two aggregation layers keep the HTTP rate minimal:
//   1. JSON-RPC batching (batch.wait) — concurrent calls share one request;
//   2. multicall3 (an OP-stack preinstall on GIWA, verified on-chain) —
//      contract reads collapse into single eth_calls.
// The registry load burst (~40 reads) becomes 1-2 HTTP requests.
// pollingInterval 1s keeps receipt waits honest on the 1s chain.
export const publicClient = createPublicClient({
    chain: giwaSepolia,
    transport: http(RPC_URL, { batch: { wait: 16 } }),
    pollingInterval: 1_000,
    batch: { multicall: { wait: 16 } },
});

// Wallet plumbing: injected connectors only (EIP-6963 discovery picks up
// MetaMask/Rabby/Coinbase etc). WalletConnect is REJECTED by standing ruling
// (S06 ratification): a new dep + cloud project id for zero demo value.
export const wagmiConfig = createConfig({
    chains: [giwaSepolia],
    connectors: [injected()],
    transports: { [giwaSepolia.id]: http(RPC_URL, { batch: { wait: 16 } }) },
});
