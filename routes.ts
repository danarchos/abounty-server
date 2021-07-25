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
  const node = db.getNodeByToken(token);
  if (!node) throw new Error("Node not found with this token");

  // get the node's pubkey and alias
  const rpc = lightning.getRpc(node.token);
  const { alias, identityPubkey: pubkey } = await rpc.getInfo();
  const { balance } = await rpc.channelBalance();
  res.send({ alias, balance, pubkey });
};

/**
 * POST /api/posts/:id/invoice
 */
export const postInvoice = async (req: Request, res: Response) => {
  const { id } = req.params;
  // find the post
  const post = db.getPostById(parseInt(id));
  if (!post) throw new Error("Post not found");
  // find the node that made this post
  const node = db.getNodeByPubkey(post.pubkey);
  if (!node) throw new Error("Node not found for this post");

  // create an invoice on the poster's node
  const rpc = lightning.getRpc(node.token);
  const amount = 100;
  const inv = await rpc.addInvoice({ value: amount.toString() });
  res.send({
    payreq: inv.paymentRequest,
    hash: (inv.rHash as Buffer).toString("base64"),
    amount,
  });
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
