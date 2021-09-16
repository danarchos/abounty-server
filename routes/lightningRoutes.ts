import { Request, Response } from "express";
import ln, { NodeEvents } from "../Lightning";
import db from "../Supabase";
import { createHash, randomBytes } from "crypto";
import ByteBuffer from "bytebuffer";
import * as lightning from "lightning";
import sha, { sha256 } from "js-sha256";
import moment from "moment";
import { bech32 } from "bech32";

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

  await ln.subscribeToInvoice(lnd, inv.id, bountyId);

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

export const withdrawRequest = async (req: Request, res: Response) => {
  const nonce = Math.floor(Math.random() * 1000000).toString();

  let url = bech32.toWords(
    Buffer.from(
      process.env.NGROK_INSTANCE_URL + "/initiate-withdrawal?q=" + nonce,
      "utf8"
    )
  );

  const encodedUrl = bech32.encode("LNURL", url, 1028).toLocaleUpperCase();

  const secret = createHash("sha256").update(nonce).digest("hex");

  ln.setLnurlSecret(secret, "123e4567-e89b-12d3-a456-426614174000");

  res.send({ withdrawRequest: encodedUrl });
};

export const initiateWithdrawal = async (req: Request, res: Response) => {
  const { q } = req.query;

  if (!q) {
    res.send({ success: false, message: "Missing query" });
    return;
  }

  const secret = createHash("sha256").update(q.toString()).digest("hex");
  const storedSecret = ln.getLnurlSecret(secret);
  if (storedSecret) {
    const secondLevelNonce = Math.floor(Math.random() * 1000000).toString();
    const k1Hash = createHash("sha256").update(secondLevelNonce).digest("hex");
    ln.setLnurlk1(k1Hash, "123e4567-e89b-12d3-a456-426614174000");
    ln.deleteSecretRecord(secret);
    res.json({
      callback: process.env.NGROK_INSTANCE_URL + "/execute-withdrawal",
      minWithdrawable: 1,
      k1: secondLevelNonce,
      maxWithdrawable: 2000, // msat
      defaultDescription: "withdraw from abounty",
      tag: "withdrawRequest",
    });
  }
  res.send({ success: false, message: "No matching secret" });
};

export const executeWithdrawal = async (req: Request, res: Response) => {
  const { pr, k1 } = req.query;
  if (!pr || !k1) {
    res.json({ status: "ERROR", reason: "Invalid pr or k1" });
    return;
  }
  const k1Hash = createHash("sha256").update(k1.toString()).digest("hex");
  const storedk1 = ln.getlnUrlk1(k1Hash);
  if (storedk1) {
    // pay invoice
    ln.deletek1Record(k1Hash);
    // send response
  }
};
