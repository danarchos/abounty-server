import { Request, Response } from "express";
import db from "../Supabase";

export const createBounty = async (req: Request, res: Response) => {
  const { user, description, subject, speakers, tags } = req.body;

  const created = new Date();

  const response = await db.createBounty({
    created,
    subject,
    user,
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

export const testing = (req: Request, res: Response) => {
  console.log("test");
  res.send({ ok: "hey" });
};

export const bounty = async (req: Request, res: Response) => {
  const { id } = req.params;
  const bounty = await db.getBounty(id);
  res.send(bounty);
};

export const completeBounty = async (req: Request, res: Response) => {
  const { id } = req.body;
  const bounty = await db.completeBounty(id);
  res.send(bounty);
};

export const updateSpeaker = async (req: Request, res: Response) => {
  const { speakers, userId, bountyId } = req.body;
  const updated = await db.updateSpeaker(speakers, userId, bountyId);
  res.send(updated);
};

export const getRewards = async (req: Request, res: Response) => {
  const { username } = req.params;

  const response = await db.getCompleteBounties();
  if (response) {
    const filterByUser = response.filter((bounty) => {
      const userInBounty = bounty.speakers.find(
        (speaker: any) => speaker.username === username
      );

      if (userInBounty) return true;
      return false;
    });
    res.send(filterByUser);
  }
};

export const getReward = async (req: Request, res: Response) => {
  const { id } = req.params;

  const response = await db.getCompleteBounty(id);

  res.send(response);
  // if (response) {
  //   const filterByUser = response.filter((bounty) => {
  //     const userInBounty = bounty.speakers.find(
  //       (speaker: any) => speaker.username === username
  //     );

  //     if (userInBounty) return true;
  //     return false;
  //   });
  //   res.send(filterByUser);
  // }
};
