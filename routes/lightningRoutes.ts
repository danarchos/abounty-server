import { Request, Response } from "express";
import lightning from "../Lightning";
import db from "../Supabase";

/**
 * POST /api/connect
 */
export const connect = async (req: Request, res: Response) => {
  const { host } = req.body;
  const { token, pubkey } = await lightning.connect(host);
  await db.addNode({ host, token, pubkey });
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
  const rpc = lightning.getRpc();
  const { alias, identityPubkey: pubkey } = await rpc.getInfo();
  const { balance } = await rpc.channelBalance();
  res.send({ alias, balance, pubkey });
};

export const createBountyInvoice = async (req: Request, res: Response) => {
  const { amount, userId, bountyId } = req.body;
  const rpc = lightning.getRpc();
  const inv = await rpc.addInvoice({
    value: amount.toString(),
    // memo: userId && bountyId ? JSON.stringify({ userId, bountyId }) : undefined,
  });
  res.send({
    payreq: inv.paymentRequest,
    hash: (inv.rHash as Buffer).toString("base64"),
    amount,
  });
};

export const createInvoice = async (req: Request, res: Response) => {
  const { token, amount } = req.body;
  const rpc = lightning.getRpc();
  const inv = await rpc.addInvoice({ value: amount.toString() });
  res.send({
    payreq: inv.paymentRequest,
    hash: (inv.rHash as Buffer).toString("base64"),
    amount,
  });
};
