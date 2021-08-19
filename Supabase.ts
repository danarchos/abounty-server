import { EventEmitter } from "events";
import { createClient } from "@supabase/supabase-js";
import moment from "moment";
require("dotenv").config();

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_ANON_KEY ?? "";

export interface LndNode {
  token: string;
  host: string;
  pubkey: string;
}

export interface Bounty {
  subject: string;
  userId: string;
  speakers: { username: string; confirmed: boolean };
  description: string;
  created: Date;
  tags: string[];
  active: boolean;
}

export interface Payment {
  request: string | undefined;
  hash: string | undefined;
  amount: number | undefined;
  creationDate: string | undefined;
  userId: string | undefined;
  bountyId: string | undefined;
  secret: string | undefined;
  username: string | undefined;
  expiry: number | undefined;
}

// Can use EventEmitter in future to emit an event.
class Supabase extends EventEmitter {
  private client = createClient(url, key);

  async getAllSupaNodes() {
    const { data } = await this.client.from("nodes");
    if (!data) return [];
    return data;
  }

  async getNodeByPubkey(pubkey: string) {
    const allSupaData = await this.client.from("nodes");
    const allNodes = allSupaData.data ?? [];
    return allNodes.find((node) => node.pubkey === pubkey);
  }

  async getNodeByToken(token: string) {
    const allSupaData = await this.client.from("nodes");
    const allNodes = allSupaData.data ?? [];
    return allNodes.find((node) => node.token === token);
  }

  async getAllBounties() {
    const { data } = await this.client.from("bounties");
    if (!data) return [];
    return data;
  }

  async getAllPendingInvoices() {
    const { data } = await this.client
      .from("payments")
      .select("*")
      .match({ status: "PENDING" });
    if (!data) return [];
    return data;
  }

  async getAllExpiredBounties() {
    const currentTime = moment().unix();
    const { data } = await this.client
      .from("bounties")
      .select("id")
      .lte("expiry", currentTime);
    if (!data) return [];
    return data;
  }

  async expireBounties() {
    const currentTime = moment().unix();
    const { data } = await this.client
      .from("bounties")
      .update({ status: "EXPIRED" })
      .match({ status: "OPEN" })
      .lte("expiry", currentTime);
    return data;
  }

  async createBounty(bounty: Bounty) {
    const { subject, speakers, tags, active, description, userId } = bounty;
    const response = await this.client.from("bounties").insert({
      subject,
      speakers,
      expiry: moment().unix() + 100,
      created: moment().unix(),
      tags,
      description,
      userId,
    });
    return response;
  }

  async getNode() {
    const allSupaData = await this.client.from("nodes");
    if (allSupaData?.data) return allSupaData.data[0] ?? null;
  }

  async addNode(node: LndNode) {
    const { host, pubkey, token } = node;
    await this.client.from("nodes").insert({
      host,
      pubkey,
      token,
    });
  }

  async addPayment(payment: Payment) {
    const {
      hash,
      request,
      amount,
      creationDate,
      userId,
      bountyId,
      secret,
      expiry,
      username,
    } = payment;

    const response = await this.client.from("payments").insert({
      request,
      hash,
      value: amount,
      creationDate,
      userId,
      secret,
      expiry,
      bountyId,
      username,
    });

    return response;
  }

  async settlePayment(date: any, hash: string) {
    const { data, error } = await this.client
      .from("payments")
      .update({ status: "SETTLED", settleDate: date })
      .match({ hash });

    console.log({ data, error });
  }

  async heldPayment(hash: string) {
    const { data, error } = await this.client
      .from("payments")
      .update({ status: "HELD" })
      .match({ hash });

    console.log({ data, error });
  }

  async cancelPayment(hash: string) {
    const { data, error } = await this.client
      .from("payments")
      .update({ status: "CANCELED" })
      .match({ hash });

    console.log({ data, error });
  }

  async updateInvoice(hash: string, status: "CANCELED" | "HELD" | "SETTLED") {
    const { data, error } = await this.client
      .from("payments")
      .update({ status })
      .match({ hash });

    console.log({ data, error });
  }
}

export default new Supabase();
