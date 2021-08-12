import createLnRpc, { createRouterRpc, LnRpc, RouterRpc } from "@radar/lnrpc";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { LndNode } from "./Supabase";
import db from "./Supabase";
import * as lightning from "lightning";
import { AuthenticatedLnd } from "lightning";

export const NodeEvents = {
  invoiceUpdated: "invoice-updated",
};

class Lightning extends EventEmitter {
  /**
   * a mapping of token to gRPC connection. This is an optimization to
   * avoid calling `createLnRpc` on every request. Instead, the object is kept
   * in memory for the lifetime of the server.
   */
  private lnd: AuthenticatedLnd | null = null;
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

      console.log({ connected: public_key });

      this.lnd = lnd;
      this.pubkey = public_key;

      this.listenForPayments(lnd, public_key);
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

  /**
   * listen for payments made to the node. When a payment is settled, emit
   * the `invoicePaid` event to notify listeners of the NodeManager
   */
  async listenForPayments(lnd: AuthenticatedLnd, pubkey: string) {
    const stream = lightning.subscribeToInvoices({ lnd });
    stream.on("invoice_updated", (invoice) => {
      console.log({ invoice_updated: invoice });
      const { confirmed_at, tokens, id } = invoice;
      if (invoice.is_confirmed) db.confirmPayment(confirmed_at, id);
      this.emit(NodeEvents.invoiceUpdated, {
        hash: id,
        amount: tokens,
        pubkey,
      });
    });
  }
}

export default new Lightning();
