import { Router } from "express";
import LightningController from "../controllers/lightning";

const lightningRoutes = Router();

lightningRoutes.post("/create-invoice", LightningController.createInvoice);
lightningRoutes.post("/cancel-invoice", LightningController.cancelInvoice);
lightningRoutes.post("/settle-invoice", LightningController.settleInvoice);
lightningRoutes.post("/connect", LightningController.connect);
lightningRoutes.post(
  "/create-bounty-invoice",
  LightningController.createBountyInvoice
);

lightningRoutes.get("/get-invoice", LightningController.getInvoice);
lightningRoutes.get("/withdraw-request", LightningController.withdrawRequest);
lightningRoutes.get(
  "/initiate-withdrawal",
  LightningController.initiateWithdrawal
);
lightningRoutes.get(
  "/execute-withdrawal",
  LightningController.executeWithdrawal
);

export { lightningRoutes };
