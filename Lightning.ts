import createLnRpc, { createRouterRpc, LnRpc, RouterRpc } from "@radar/lnrpc";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { LndNode } from "./Supabase";
import db from "./Supabase";
import * as lightning from "lightning";
import { AuthenticatedLnd } from "lightning";
import moment from "moment";
import { Hash } from "crypto";

export const NodeEvents = {
  invoiceUpdated: "invoice-updated",
  invoicePaid: "invoice-paid",
  bountyCreated: "bounty-created",
};

interface Hashmap {
  [hash: string]: string;
}

class Lightning extends EventEmitter {
  /**
   * a mapping of token to gRPC connection. This is an optimization to
   * avoid calling `createLnRpc` on every request. Instead, the object is kept
   * in memory for the lifetime of the server.
   */
  private lnd: AuthenticatedLnd | null = null;
  private lnurlSecretMap: Record<string, string> = {};
  private lnurlK1Map: Record<string, string> = {};
  public pubkey: string | null = null;
  // private routerRpc: RouterRpc | null = null;

  /**
   * Retrieves the in-memory connection to an LND node
   */
  getLnd(): AuthenticatedLnd {
    if (!this.lnd) {
      throw new Error("Not Authorized. You must login first!");
    }

    return this.lnd;
  }

  setLnurlSecret(hash: string, user: string) {
    this.lnurlSecretMap[hash] = user;
  }

  setLnurlk1(k1: string, user: string) {
    this.lnurlK1Map[k1] = user;
  }

  getLnurlSecret(hash: string) {
    const secret = this.lnurlSecretMap[hash];
    delete this.lnurlSecretMap[hash];
    if (secret) return secret;
    return null;
  }

  getlnUrlk1(k1: string) {
    const k1Record = this.lnurlK1Map[k1];
    delete this.lnurlK1Map[k1];
    if (k1Record) return k1Record;
    return null;
  }

  deletek1Record(k1: string) {
    delete this.lnurlK1Map[k1];
  }
  deleteSecretRecord(secret: string) {
    delete this.lnurlSecretMap[secret];
  }

  /**
   * Tests the LND node connection by validating that we can get the node's info
   */
  async connect() {
    try {
      const { lnd } = await lightning.authenticatedLndGrpc({
        macaroon: process.env.MACAROON,
        socket: process.env.HOST,
      });

      const msg = Buffer.from("authorization test").toString("base64");

      // Verifiy I can sign a message
      await lightning.signMessage({
        lnd,
        message: msg,
      });

      // Get the public key
      const { public_key } = await lightning.getIdentity({ lnd });
      this.syncInvoices(lnd);
      console.log("connected lnd");

      this.lnd = lnd;
      this.pubkey = public_key;

      // this.listenForPayments(lnd, public_key);
    } catch (err) {
      console.log({ err });
    }

    return;
  }

  /**
   * Reconnect to all persisted nodes to to cache the `LnRpc` objects
   * @param nodes the list of nodes
   */
  async reconnectNode(nodes: LndNode[]) {
    const node = process.env.NODE_PUBKEY;
    const host = process.env.HOST;

    if (!node || !host) {
      console.error(`Failed to reconnect to LND node, couldn't find your node`);
      return;
    }

    // const { host, token } = node;
    // console.log({ host, token });
    try {
      console.log(`Reconnecting to LND node ${host}`);
      await this.connect();
    } catch (error) {
      // the token will not be cached
      console.error(`Failed to reconnect to LND node ${host}`);
    }
  }

  // TEST THIS PROPERLY
  async syncInvoices(lnd: AuthenticatedLnd) {
    const invoiceDetails = await lightning.getInvoices({ lnd });
    const pendingHeldInvoices = await db.getAllPendingAndHeldInvoices();

    const filteredInvoices = invoiceDetails.invoices.filter(
      (invoice) =>
        invoice.is_confirmed || invoice.is_held || invoice.is_canceled
    );

    await Promise.all(
      pendingHeldInvoices.map(async (invoice) => {
        const foundInvoice = filteredInvoices.find(
          (inv) => inv.id === invoice.hash
        );
        if (foundInvoice) {
          if (foundInvoice.is_held) {
            if (
              pendingHeldInvoices.find((item) => item.hash === invoice.hash)
                .status === "HELD"
            ) {
              return;
            }
            await db.updateInvoice(invoice.hash, "HELD");
            return;
          }

          if (foundInvoice.is_canceled) {
            await db.updateInvoice(invoice.hash, "CANCELED");
            return;
          }

          if (foundInvoice.is_confirmed) {
            await db.updateInvoice(invoice.hash, "SETTLED");
            return;
          }

          if (this.lnd)
            await this.subscribeToInvoice(
              this.lnd,
              foundInvoice.id,
              invoice.bountyId
            );
        }
      })
    );
  }

  async subscribeToInvoice(
    lnd: AuthenticatedLnd,
    id: string,
    bountyId: string
  ) {
    const stream = lightning.subscribeToInvoice({ lnd, id });
    stream.on("invoice_updated", async (invoice) => {
      console.log({
        invoice_updated: {
          id: invoice.id,
          held: invoice.is_held,
          canceled: invoice.is_canceled,
          confirmed: invoice.is_confirmed,
        },
      });
      const { confirmed_at, id } = invoice;
      if (invoice.is_held) {
        await db.updateInvoice(id, "HELD");
        await db.calculateBountyBalance(invoice.id);
        this.emit(NodeEvents.invoicePaid, { hash: invoice.id, bountyId });
      }
      if (invoice.is_confirmed) await db.settlePayment(confirmed_at, id);
      if (invoice.is_canceled) await db.updateInvoice(id, "CANCELED");
    });
  }

  /*
  SUBSCRIBE TO ALL INVOICES
   * listen for payments made to the node. When a payment is settled, emit
   * the `invoicePaid` event to notify listeners of the NodeManager
   */
  // async listenForPayments(lnd: AuthenticatedLnd, pubkey: string) {
  //   const stream = lightning.subscribeToInvoices({ lnd });
  //   stream.on("status", (invoice) => {
  //     console.log({ STATUS_UPDATE: invoice });
  //   });
  //   stream.on("invoice_updated", (invoice) => {
  //     console.log({ invoice_updated: invoice });
  //     const { confirmed_at, tokens, id } = invoice;
  //     if (invoice.is_confirmed) db.confirmPayment(confirmed_at, id);
  //     this.emit(NodeEvents.invoiceUpdated, {
  //       hash: id,
  //       amount: tokens,
  //       pubkey,
  //     });
  //   });
  // }
}

export default new Lightning();
