import { Request, Response } from "express";
import lightning from "./Lightning";
import db from "./Supabase";

/**
 * POST /api/connect
 */
export const connect = async (req: Request, res: Response) => {
  const { host, cert, macaroon } = req.body;
  const { token, pubkey } = await lightning.connect(host, cert, macaroon);
  await db.addNode({ host, cert, macaroon, token, pubkey });
  res.send({ token });
};

/**
 * GET /api/info
 */
export const getInfo = async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) throw new Error("Your node is not connected!");
  // find the node that's making the request
  const node = await db.getNodeByToken(token);
  if (!node) throw new Error("Node not found with this token");

  // get the node's pubkey and alias
  const rpc = lightning.getRpc(node.token);
  const { alias, identityPubkey: pubkey } = await rpc.getInfo();
  const { balance } = await rpc.channelBalance();
  res.send({ alias, balance, pubkey });
};

export const createInvoice = async (req: Request, res: Response) => {
  const { token, amount } = req.body;
  const rpc = lightning.getRpc(token);
  const inv = await rpc.addInvoice({ value: amount.toString() });
  res.send({
    payreq: inv.paymentRequest,
    hash: (inv.rHash as Buffer).toString("base64"),
    amount,
  });
};

export const testGet = async (req: Request, res: Response) => {
  console.log("triggered testPost");
  const node = await db.getNodeByPubkey(
    "020086a2eadc25e6d742c4026dbf2b04760d03f73628fe596c3c659a8255f19ec8"
  );
  console.log({ node });
  res.send({
    node: node,
  });
};
