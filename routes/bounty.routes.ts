import { Router } from "express";
import BountyController from "../controllers/bounty";

const bountyRoutes = Router();

bountyRoutes.get("/live-bounties", BountyController.liveBounties);
bountyRoutes.get("/bounty/:id", BountyController.bounty);
bountyRoutes.get("/rewards/:username", BountyController.getRewards);
bountyRoutes.get("/reward/:id", BountyController.getReward);
bountyRoutes.post("/create-bounty", BountyController.createBounty);
bountyRoutes.post("/update-speaker", BountyController.updateSpeaker);
bountyRoutes.post("/complete-bounty", BountyController.completeBounty);
bountyRoutes.post("/expire-bounty", BountyController.expireBounty);

export { bountyRoutes };
