import { EventEmitter } from "events";
import { createClient } from "@supabase/supabase-js";
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
  author: string;
  speakers: { username: string; confirmed: boolean };
  expiry: Date;
  description: string;
  created: Date;
  tags: string[];
  active: boolean;
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
    const {
      subject,
      speakers,
      expiry,
      created,
      tags,
      active,
      description,
      author,
    } = bounty;
    const response = await this.client.from("bounties").insert({
      subject,
      speakers,
      expiry,
      created,
      tags,
      active,
      description,
      author,
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
}

export default new Supabase();
