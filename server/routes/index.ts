import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import verifyTestnetRouter from "./verifyTestnet.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(verifyTestnetRouter);

export default router;
