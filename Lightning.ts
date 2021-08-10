import createLnRpc, { createRouterRpc, LnRpc, RouterRpc } from "@radar/lnrpc";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { LndNode } from "./Supabase";
import db from "./Supabase";
import * as lightning from "lightning";
import { AuthenticatedLnd } from "lightning";

export const NodeEvents = {
  invoicePaid: "invoice-paid",
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
   * Retrieves the in-memory connection to an LND node
   */
  // getRouterRpc(): RouterRpc {
  //   if (!this.routerRpc) {
  //     throw new Error("Not Authorized. You must login first!");
  //   }

  //   return this.routerRpc;
  // }

  /**
   * Tests the LND node connection by validating that we can get the node's info
   */
  async connect() {
    // generate a random token, without
    // const token = prevToken || uuidv4().replace(/-/g, "");

    // const config = {
    //   server: host,
    //   tls: "",
    //   cert: "",
    //   macaroonPath: "./admin.macaroon",
    // };

    // try {
    //   // add the connection to the cache
    //   const lnRpc = await createLnRpc(config);
    //   const routerRpc = await createRouterRpc(config);

    //   // verify we have permission get node info
    //   const { identityPubkey: pubkey } = await lnRpc.getInfo();

    //   // verify we have permission to get channel balances
    //   await lnRpc.channelBalance();

    //   // verify we can sign a message
    //   const msg = Buffer.from("authorization test").toString("base64");
    //   const { signature } = await lnRpc.signMessage({ msg });

    //   // verify we have permission to verify a message
    //   await lnRpc.verifyMessage({ msg, signature });

    //   // verify we have permissions to create a 1sat invoice
    //   const { rHash } = await lnRpc.addInvoice({ value: "1" });

    //   // verify we have permission to lookup invoices
    //   await lnRpc.lookupInvoice({ rHash });

    //   // listen for payments from LND
    //   this.listenForPayments(lnRpc, pubkey);

    //   // store this rpc connection in the in-memory list
    //   this.lnRpc = lnRpc;
    //   this.routerRpc = routerRpc;

    //   console.log("connected", { pubkey });
    //   // return this node's token for future requests
    //   return { token, pubkey };
    // } catch (err) {
    //   // remove the connection from the cache since it is not valid
    //   if (this.lnRpc) {
    //     this.lnRpc = null;
    //   }
    //   throw err;
    // }

    try {
      const { lnd } = await lightning.authenticatedLndGrpc({
        macaroon: process.env.MACAROON,
        socket: process.env.HOST,
      });

      const msg = Buffer.from("authorization test").toString("base64");
      const { signature } = await lightning.signMessage({
        lnd,
        message: msg,
      });
      console.log({ signature });

      const { public_key } = await lightning.getIdentity({ lnd });
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
    stream.on("data", (invoice) => {
      console.log("invoice created");
      if (invoice.settled) {
        const { paymentRequest, value, creationDate, settleDate, memo } =
          invoice;

        let userId;
        let bountyId;

        if (memo) {
          const json = JSON.parse(memo);
          userId = json.userId;
          bountyId = json.bountyId;
        }

        db.addPayment({
          paymentRequest,
          value,
          creationDate,
          settleDate,
          userId,
          bountyId,
        });
        const hash = (invoice.rHash as Buffer).toString("base64");
        const amount = invoice.amtPaidSat;
        this.emit(NodeEvents.invoicePaid, { hash, amount, pubkey });
      }
    });
  }
}

export default new Lightning();
