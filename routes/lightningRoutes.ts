import { Request, Response } from "express";
import ln, { NodeEvents } from "../Lightning";
import db from "../Supabase";
import { createHash, randomBytes } from "crypto";
import ByteBuffer from "bytebuffer";
import * as lightning from "lightning";
import sha, { sha256 } from "js-sha256";
import moment from "moment";

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
  const { amount, userId, bountyId, username } = req.body;
  const lnd = ln.getLnd();

  const preimage = randomBytes(32);
  const id = createHash("sha256").update(preimage).digest().toString("hex");
  const secret = preimage.toString("hex");

  const expiry = moment();

  const inv = await lightning.createHodlInvoice({
    id,
    lnd,
    tokens: amount,
    expires_at: expiry.add(1, "hours").toISOString(),
  });

  try {
    await db.addPayment({
      request: inv.request,
      hash: inv.id,
      amount,
      userId,
      bountyId,
      creationDate: inv.created_at,
      secret: secret,
      username,
      expiry: expiry.add(2, "hours").unix(),
    });
  } catch (err) {
    console.log("error db", err);
  }

  await ln.subscribeToInvoice(lnd, inv.id);

  res.send({
    payreq: inv.request,
    hash: inv.id,
    amount,
  });
};

export const cancelInvoice = async (req: Request, res: Response) => {
  const { id } = req.body;
  const lnd = ln.getLnd();

  try {
    await lightning.cancelHodlInvoice({
      id,
      lnd,
    });
    await db.updateInvoice(id, "CANCELED");
    res.send({
      message: "Successfully cancelled hodl invoice",
    });
  } catch (err) {
    console.log({ err });
    res.send({
      err,
    });
  }
};

export const settleInvoice = async (req: Request, res: Response) => {
  const { hash, secret } = req.body;
  const lnd = ln.getLnd();

  try {
    const response = await lightning.settleHodlInvoice({
      secret,
      lnd,
    });

    await db.updateInvoice(hash, "SETTLED");
    console.log("response", response);
    res.send({
      response,
    });
  } catch (err) {
    console.log({ err });
    res.send({
      err,
    });
  }
};

export const getInvoice = async (req: Request, res: Response) => {
  const { id } = req.body;
  const lnd = ln.getLnd();

  try {
    const response = await lightning.getInvoice({
      id,
      lnd,
    });
    console.log("response", response);
    res.send({
      invoice: response,
    });
  } catch (err) {
    console.log({ err });
    res.send({
      ok: false,
    });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  const { amount } = req.body;
  const lnd = ln.getLnd();
  const inv = await lightning.createInvoice({ lnd, tokens: amount });
  res.send({
    payreq: inv.request,
    hash: inv.id,
    amount: inv.tokens,
  });
};

export const cancelPendingChannel = async (req: Request, res: Response) => {
  const { id } = req.body;
  const lnd = ln.getLnd();

  try {
    const response = await lightning.cancelPendingChannel({ lnd, id });
    console.log(response);
  } catch (err) {
    console.log(err);
  }
};

// export const sendKeysend = async (req: Request, res: Response) => {
//   const lnd = ln.getLnd();

//   const preimage = crypto.randomBytes(32);
//   const myWosPub =
//     "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226";
//   const wosPub =
//     "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226";
//   const muunPubkey =
//     "03d831eb02996b2e0eda05d01a3f17d998f620a9c842f28fa75ca028aab8d103e7";
//   const pubkey =
//     "03d805d0c6ad3306441c8e8c076cdcaa9a13064ed606376282cd1154c1ab0ed9ae";

//   const keySendPreimageType = "5482373484";
//   const id = crypto
//     .createHash("sha256")
//     .update(preimage)
//     .digest()
//     .toString("hex");
//   const secret = preimage.toString("hex");

//   try {
//     // @ts-ignore
//     const response = await lightning.payViaPaymentDetails({
//       lnd,
//       destination: selfPubkey,
//       tokens: 210,
//       id,
//       pathfinding_timeout: 100,
//       messages: [{ type: keySendPreimageType, value: secret }],
//       // routes: [
//       //   [
//       //     {
//       //       public_key: "035e4ff418fc8b5554c5d9eea66396c227bd429a3251c8cbc711002ba215bfc226",
//       //     },
//       //   ],
//       // ],
//     });
//     console.log({ response });
//   } catch (err) {
//     console.log({ err });
//   }
// };
