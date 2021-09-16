import express, { Request, Response } from "express";
import expressWs from "express-ws";
import cors from "cors";
import { SocketEvents } from "./types";
import ln, { NodeEvents } from "./Lightning";
import db from "./Supabase";
import cron from "node-cron";
import * as lnRoutes from "./routes/lightningRoutes";
import * as bountyRoutes from "./routes/bountyRoutes";
import * as twitterRoutes from "./routes/twitterRoutes";

require("dotenv").config();

// const server = lnurl.createServer({
//   host: "localhost",
//   port: 4001,
//   url: "https://f17e-92-2-206-252.ngrok.io",
//   // endpoint: "/tester",
//   lightning: {
//     backend: "lnd",
//     config: {
//       hostname: process.env.HOST,
//       cert: { data: process.env.TLS_CERT },
//       macaroon: { data: process.env.MACAROON },
//     },
//   },
// });

// const tag = "withdrawRequest";
// const params = {
//   minWithdrawable: 1,
//   defaultDescription: "tester",
//   maxWithdrawable: 100,
//   k1: "k1",
//   callback: "https://d133-148-252-128-171.ngrok.io/testing",
// };

// server
//   .generateNewUrl(tag, params)
//   .then((result: any) => {
//     const { encoded, secret, url } = result;
//     console.log({ encoded, secret, url });

//     const secret2 = randomBytes(32).toString("hex");
//     const hash = createHash("sha256").update(secret2).digest("hex");

//     console.log({ secret2, hash });
//   })
//   .catch((error: any) => {
//     console.error(error);
//   });

const PORT: number = 4000;

const { app } = expressWs(express());
app.use(cors());
app.use(express.json());

// simple middleware to grab the token from the header and add
// it to the request's body
app.use((req, res, next) => {
  req.body.token = req.header("X-Token");
  next();
});

/**
 * ExpressJS will hang if an async route handler doesn't catch errors and return a response.
 * To avoid wrapping every handler in try/catch, just call this func on the handler. It will
 * catch any async errors and return
 */
export const catchAsyncErrors = (
  routeHandler: (req: Request, res: Response) => Promise<void> | void
) => {
  // return a function that wraps the route handler in a try/catch block and
  // sends a response on error
  return async (req: Request, res: Response) => {
    try {
      const promise = routeHandler(req, res);
      // only await promises from async handlers.
      if (promise) await promise;
    } catch (err) {
      res.status(400).send({ error: err.message });
    }
  };
};

app.get("/testing", catchAsyncErrors(bountyRoutes.testing));

//
// Bounties
//
app.get("/bounties", catchAsyncErrors(bountyRoutes.allBounties));
app.get("/bounty/:id", catchAsyncErrors(bountyRoutes.bounty));
app.get("/rewards/:username", catchAsyncErrors(bountyRoutes.getRewards));
app.get("/reward/:id", catchAsyncErrors(bountyRoutes.getReward));
app.post("/create-bounty", catchAsyncErrors(bountyRoutes.createBounty));
app.post("/update-speaker", catchAsyncErrors(bountyRoutes.updateSpeaker));
app.post("/complete-bounty", catchAsyncErrors(bountyRoutes.completeBounty));

//
// LN Routes
//
app.post(
  "/create-bounty-invoice",
  catchAsyncErrors(lnRoutes.createBountyInvoice)
);
app.post("/create-invoice", catchAsyncErrors(lnRoutes.createInvoice));
app.post("/cancel-invoice", catchAsyncErrors(lnRoutes.cancelInvoice));
app.post("/settle-invoice", catchAsyncErrors(lnRoutes.settleInvoice));
app.get("/get-invoice", catchAsyncErrors(lnRoutes.getInvoice));

app.get("/withdraw-request", catchAsyncErrors(lnRoutes.withdrawRequest));
app.get("/initiate-withdrawal", catchAsyncErrors(lnRoutes.initiateWithdrawal));
app.get("/execute-withdrawal", catchAsyncErrors(lnRoutes.executeWithdrawal));

// Twitter routes
app.get("/usernames", catchAsyncErrors(twitterRoutes.usernames));

// from example app
app.post("/connect", catchAsyncErrors(lnRoutes.connect));
// app.get("/info", catchAsyncErrors(lnRoutes.getInfo));

cron.schedule("* * * * *", async () => {
  await db.expireBounties();
});

//
// Configure Websocket
//
app.ws("/events", (ws, req) => {
  console.log("called ws connection");

  const bountyToListenTo = req.query.bountyId;

  const paymentsListener = (info: any) => {
    if (info.bountyId === bountyToListenTo) {
      const event = { type: SocketEvents.invoiceUpdated, data: info };
      ws.send(JSON.stringify(event));
    }
  };

  // add listeners to to send data over the socket
  // db.on(PostEvents.updated, postsListener);
  ln.on(NodeEvents.invoicePaid, paymentsListener);

  // remove listeners when the socket is closed
  ws.on("close", () => {
    // db.off(PostEvents.updated, postsListener);
    ln.off(NodeEvents.invoicePaid, paymentsListener);
  });
});

// Start Server
//
console.log("Starting API server...");
app.listen(PORT, async () => {
  console.log(`API listening at http://localhost:${PORT}`);

  const allNodes = await db.getAllSupaNodes();
  await ln.reconnectNode(allNodes);
});
