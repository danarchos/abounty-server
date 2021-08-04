import express, { Request, Response } from "express";
import expressWs from "express-ws";
import cors from "cors";
import { SocketEvents } from "./types";
import lightning, { NodeEvents } from "./Lightning";
import db from "./Supabase";
import * as lnRoutes from "./routes/lightningRoutes";
import * as bountyRoutes from "./routes/bountyRoutes";
require("dotenv").config();

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

//
// Bounties
//
app.get("/bounties", catchAsyncErrors(bountyRoutes.allBounties));
app.post("/create-bounty", catchAsyncErrors(bountyRoutes.createBounty));

//
// LN Routes
//
app.post(
  "/create-bounty-invoice",
  catchAsyncErrors(lnRoutes.createBountyInvoice)
);

// from example app
app.post("/connect", catchAsyncErrors(lnRoutes.connect));
app.get("/info", catchAsyncErrors(lnRoutes.getInfo));

//
// Configure Websocket
//
app.ws("/events", (ws) => {
  // when a websocket connection is made, add listeners for posts and invoices
  // const postsListener = (posts: Post[]) => {
  //   const event = { type: SocketEvents.postUpdated, data: posts };
  //   ws.send(JSON.stringify(event));
  // };

  const paymentsListener = (info: any) => {
    const event = { type: SocketEvents.invoicePaid, data: info };
    ws.send(JSON.stringify(event));
  };

  // add listeners to to send data over the socket
  // db.on(PostEvents.updated, postsListener);
  lightning.on(NodeEvents.invoicePaid, paymentsListener);

  // remove listeners when the socket is closed
  ws.on("close", () => {
    // db.off(PostEvents.updated, postsListener);
    lightning.off(NodeEvents.invoicePaid, paymentsListener);
  });
});

// Start Server
//
console.log("Starting API server...");
app.listen(PORT, async () => {
  console.log(`API listening at http://localhost:${PORT}`);

  // Rehydrate data from the DB file
  const allNodes = await db.getAllSupaNodes();
  await lightning.reconnectNode(allNodes);
});
