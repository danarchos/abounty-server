import { Request, Response } from "express";
import ln from "../Lightning";
import db from "../Supabase";
import crypto from "crypto";
import ByteBuffer from "bytebuffer";
import * as lightning from "lightning";
import sha, { sha256 } from "js-sha256";

const keysendKey = "5482373484";
/**
 * POST /api/connect
 */
export const connect = async (req: Request, res: Response) => {
  await ln.connect();
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
  // const lnd = ln.getLnd();
  // const { alias, identityPubkey: pubkey } = await rpc.getInfo();
  // const { balance } = await lnd.channelBalance();
  // res.send({ alias, balance, pubkey });
};

export const createBountyInvoice = async (req: Request, res: Response) => {
  const { amount, userId, bountyId } = req.body;
  const lnd = ln.getLnd();

  const inv = await lightning.createInvoice({ lnd, tokens: amount });
  await db.addPayment({
    request: inv.request,
    hash: inv.id,
    amount,
    userId,
    bountyId,
    creationDate: inv.created_at,
  });
  res.send({
    payreq: inv.request,
    hash: inv.id,
    amount,
  });
};

export const sendKeysend = async (req: Request, res: Response) => {
  console.log("hit");
  // const { pubkey } = req.body;
  // const randoStr = crypto.randomBytes(32).toString("base64");

  const lnd = ln.getLnd();

  const preimage = crypto.randomBytes(32);
  const myWosPub =
    "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226";
  const wosPub =
    "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226";
  const muunPubkey =
    "03d831eb02996b2e0eda05d01a3f17d998f620a9c842f28fa75ca028aab8d103e7";
  const selfPubkey =
    "03d805d0c6ad3306441c8e8c076cdcaa9a13064ed606376282cd1154c1ab0ed9ae";

  const keySendPreimageType = "5482373484";
  const id = crypto
    .createHash("sha256")
    .update(preimage)
    .digest()
    .toString("hex");
  const secret = preimage.toString("hex");

  try {
    // @ts-ignore
    const response = await lightning.payViaPaymentDetails({
      lnd,
      destination: selfPubkey,
      tokens: 210,
      id,
      pathfinding_timeout: 100,
      messages: [{ type: keySendPreimageType, value: secret }],
      // routes: [
      //   [
      //     {
      //       public_key: "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226",
      //     },
      //   ],
      // ],
    });
    console.log({ response });
  } catch (err) {
    console.log({ err });
  }

  // const rpc = lightning.get();

  // const preim/age =
  // try {
  //   const response = await rpc.sendPaymentV2({
  //     dest: Buffer.from(myWosPub, "hex"),
  //     amt: 210,
  //     allowSelfPayment: true,
  //     timeoutSeconds: 30,
  //     paymentHash: preimage.toString("base64"),
  //     destCustomRecords: [[5482373484, Buffer.from(preimage)]],
  //   });

  //   console.log({ response });

  //   // circular erro, just need to see the error in postman so i can compare with the error on voltage cloud
  //   res.send({ ok: true });
  // } catch (err) {
  //   console.log("err", err);
  //   res.send({ ok: false });
  // }
};

export const createInvoice = async (req: Request, res: Response) => {
  console.log("hit");
  const { amount } = req.body;
  const lnd = ln.getLnd();
  const inv = await lightning.createInvoice({ lnd, tokens: amount });
  res.send({
    payreq: inv.request,
    hash: inv.id,
    amount: inv.tokens,
  });
};
