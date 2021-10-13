import { Request, Response } from "express";
import db from "../Supabase";
import ln from "../Lightning";

class BountyController {
  liveBounties = async (req: Request, res: Response) => {
    const bounties = await db.getLiveBounties();
    res.send(bounties);
  };

  createBounty = async (req: Request, res: Response) => {
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
    res.send({ allBounties: response.body });
  };

  expireBounty = async (req: Request, res: Response) => {
    const { id } = req.body;

    const payments = await db.getPaymentsFromBounty(id);

    Promise.all(
      payments.map(async (invoice) => await ln.cancelHodl(invoice.hash))
    );
  };

  bounty = async (req: Request, res: Response) => {
    const { id } = req.params;
    const bounty = await db.getBounty(id);
    res.send(bounty);
  };

  completeBounty = async (req: Request, res: Response) => {
    const { id } = req.body;
    const bounty = await db.completeBounty(id);
    res.send(bounty);
  };

  updateSpeaker = async (req: Request, res: Response) => {
    const { speakers, userId, bountyId } = req.body;
    const updated = await db.updateSpeaker(speakers, userId, bountyId);
    res.send(updated);
  };

  getRewards = async (req: Request, res: Response) => {
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

  getReward = async (req: Request, res: Response) => {
    const { id } = req.params;

    const response = await db.getCompleteBounty(id);

    res.send(response);
  };
}

export default new BountyController();
