import { Request, Response } from "express";
import db from "../Supabase";

export const createBounty = async (req: Request, res: Response) => {
  const { userId, description, subject, speakers, tags } = req.body;

  const created = new Date();

  const response = await db.createBounty({
    created,
    subject,
    userId,
    description,
    speakers,
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
