import { Router, type IRouter } from "express";
import { formatEther } from "viem";
import { deskPublicClient, deskAttesterAddress } from "./verifyTestnet.js";

const router: IRouter = Router();

// Attester balance is cached for 60s: the uptime pinger polls every few
// minutes and healthz must stay cheap and never hammer the RPC.
let balCache: { at: number; eth: string } | null = null;

router.get("/healthz", async (_req, res) => {
  let attesterBalanceEth: string | null = null;
  try {
    if (balCache && Date.now() - balCache.at < 60_000) {
      attesterBalanceEth = balCache.eth;
    } else {
      const wei = await deskPublicClient.getBalance({ address: deskAttesterAddress });
      attesterBalanceEth = formatEther(wei);
      balCache = { at: Date.now(), eth: attesterBalanceEth };
    }
  } catch {
    // RPC down: healthz still answers; the pinger measures the server,
    // the null balance says the chain read failed.
  }

  res.json({ status: "ok", attesterBalanceEth });
});

export default router;
