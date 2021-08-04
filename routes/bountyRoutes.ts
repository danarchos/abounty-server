import { Request, Response } from "express";
import db from "../Supabase";

export const createBounty = async (req: Request, res: Response) => {
  const { author, description, subject, speakers, tags } = req.body;

  const created = new Date();
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 30);
  const response = await db.createBounty({
    created,
    subject,
    author,
    description,
    speakers,
    expiry,
    tags,
    active: false,
  });
  console.log({ response });
  res.send({ allBounties: response.body });
};

export const allBounties = async (req: Request, res: Response) => {
  const bounties = await db.getAllBounties();
  res.send(bounties);
};
