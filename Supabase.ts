import { EventEmitter } from "events";
import { createClient } from "@supabase/supabase-js";
require("dotenv").config();

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_ANON_KEY ?? "";

export interface LndNode {
  token: string;
  host: string;
  cert: string;
  macaroon: string;
  pubkey: string;
}

export interface Bounty {
  author: string;
  subject: string;
  heads: { username: string; confirmed: boolean };
  expiry: Date;
  created: Date;
  tags: string[];
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

  async createBounty(bounty: Bounty) {
    const { author, subject, heads, expiry, created, tags } = bounty;
    const response = await this.client.from("bounties").insert({
      author,
      subject,
      heads,
      expiry,
      created,
      tags,
    });
    return response;
  }

  async addNode(node: LndNode) {
    const { host, cert, macaroon, pubkey, token } = node;
    await this.client.from("nodes").insert({
      host,
      cert,
      macaroon,
      pubkey,
      token,
    });
  }
}

export default new Supabase();
