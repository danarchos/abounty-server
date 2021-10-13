import express from "express";
import expressWs from "express-ws";
import cors from "cors";
import { SocketEvents } from "./types";
import ln, { NodeEvents } from "./Lightning";
import db from "./Supabase";
import { router } from "./routes";

require("dotenv").config();

const PORT: number = 4000;

const { app } = expressWs(express());
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  req.body.token = req.header("X-Token");
  next();
});

app.use(router);

app.ws("/events", (ws, req) => {
  const bountyToListenTo = req.query.bountyId;

  const paymentsListener = (info: any) => {
    if (info.bountyId === bountyToListenTo) {
      const event = { type: SocketEvents.invoiceUpdated, data: info };
      ws.send(JSON.stringify(event));
    }
  };

  ln.on(NodeEvents.invoicePaid, paymentsListener);

  ws.on("close", () => {
    ln.off(NodeEvents.invoicePaid, paymentsListener);
  });
});

console.log("Starting API server...");
app.listen(PORT, async () => {
  console.log(`API listening at http://localhost:${PORT}`);

  const allNodes = await db.getAllSupaNodes();
  await ln.reconnectNode(allNodes);
});

//
// // Bounties
// //
// app.get("/live-bounties", catchAsyncErrors(bountyRoutes.liveBounties));
// app.get("/bounty/:id", catchAsyncErrors(bountyRoutes.bounty));
// app.get("/rewards/:username", catchAsyncErrors(bountyRoutes.getRewards));
// app.get("/reward/:id", catchAsyncErrors(bountyRoutes.getReward));
// app.post("/create-bounty", catchAsyncErrors(bountyRoutes.createBounty));
// app.post("/update-speaker", catchAsyncErrors(bountyRoutes.updateSpeaker));
// app.post("/complete-bounty", catchAsyncErrors(bountyRoutes.completeBounty));
// app.post("/expire-bounty", catchAsyncErrors(bountyRoutes.expireBounty));

// //
// // LN Routes
// //
// app.post("/connect", catchAsyncErrors(lnRoutes.connect));

// app.post(
//   "/create-bounty-invoice",
//   catchAsyncErrors(lnRoutes.createBountyInvoice)
// );
// app.post("/create-invoice", catchAsyncErrors(lnRoutes.createInvoice));
// app.post("/cancel-invoice", catchAsyncErrors(lnRoutes.cancelInvoice));
// app.post("/settle-invoice", catchAsyncErrors(lnRoutes.settleInvoice));
// app.get("/get-invoice", catchAsyncErrors(lnRoutes.getInvoice));

// app.get("/withdraw-request", catchAsyncErrors(lnRoutes.withdrawRequest));
// app.get("/initiate-withdrawal", catchAsyncErrors(lnRoutes.initiateWithdrawal));
// app.get("/execute-withdrawal", catchAsyncErrors(lnRoutes.executeWithdrawal));

// // Twitter routes
// app.get("/usernames", catchAsyncErrors(twitterRoutes.usernames));
