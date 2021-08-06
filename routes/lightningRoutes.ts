import { Request, Response } from "express";
import lightning from "../Lightning";
import db from "../Supabase";
import crypto from 'crypto'
import ByteBuffer from 'bytebuffer'
import sha from 'js-sha256';
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
    memo: userId && bountyId ? JSON.stringify({ userId, bountyId }) : undefined,
  });
  res.send({
    payreq: inv.paymentRequest,
    hash: (inv.rHash as Buffer).toString("base64"),
    amount,
  });
};

export const sendKeysend = async (req: Request, res: Response) => {
  // const { pubkey } = req.body;
  const randoStr = crypto.randomBytes(32).toString('hex');
  const preimage = ByteBuffer.fromHex(randoStr);
  console.log('hit')
  const pubkey = "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226"
  const rpc = lightning.getRpc();
  try {
    const res = await rpc.sendPaymentSync({ 
      dest: Buffer.from(pubkey, 'base64'),
      amt: '200',
      paymentHash: Buffer.from(randoStr, 'base64'),
      // destFeatures: [9],
    })
    console.log('res', res)
  } catch (err) {
    console.log('err', err)
  }
  res.send({ ok: 'ok'})
}

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
