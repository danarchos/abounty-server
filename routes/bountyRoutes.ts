import { Request, Response } from "express";
import db from "../Supabase";

export const createBounty = async (req: Request, res: Response) => {
  const { author, subject, heads, tags } = req.body;

  const created = new Date();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  await db.createBounty({ created, author, subject, heads, expiry, tags });
  res.send({ success: true });
};

export const allBounties = async (req: Request, res: Response) => {
  const bounties = await db.getAllBounties();
  res.send(bounties);
};
