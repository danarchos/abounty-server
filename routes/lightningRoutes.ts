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
  const node = await db.getNodeByToken(token);
  if (!node) throw new Error("Node not found with this token");
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
