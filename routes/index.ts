import { Router } from "express";
import { bountyRoutes } from "./bounty.routes";
import { lightningRoutes } from "./lightning.routes";
import { twitterRoutes } from "./twitter.routes";

const router = Router();

router.use("/bounty", bountyRoutes);
router.use("/lightning", lightningRoutes);
router.use("/twitter", twitterRoutes);

export { router };
