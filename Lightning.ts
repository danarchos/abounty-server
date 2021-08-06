import createLnRpc, { LnRpc } from "@radar/lnrpc";
import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import { LndNode } from "./Supabase";
import db from "./Supabase";

export const NodeEvents = {
  invoicePaid: "invoice-paid",
};

class Lightning extends EventEmitter {
  /**
   * a mapping of token to gRPC connection. This is an optimization to
   * avoid calling `createLnRpc` on every request. Instead, the object is kept
   * in memory for the lifetime of the server.
   */
  private _lndNode: LnRpc | null = null;

  /**
   * Retrieves the in-memory connection to an LND node
   */
  getRpc(): LnRpc {
    if (!this._lndNode) {
      throw new Error("Not Authorized. You must login first!");
    }

    return this._lndNode;
  }

  /**
   * Tests the LND node connection by validating that we can get the node's info
   */
  async connect(host: string, prevToken?: string) {
    // generate a random token, without
    const token = prevToken || uuidv4().replace(/-/g, "");

    try {
      // add the connection to the cache
      const rpc = await createLnRpc({
        server: host,
        tls: "",
        cert: "",
        macaroonPath: "./admin.macaroon",
      });

      // verify we have permission get node info
      const { identityPubkey: pubkey } = await rpc.getInfo();

      // verify we have permission to get channel balances
      await rpc.channelBalance();

      // verify we can sign a message
      const msg = Buffer.from("authorization test").toString("base64");
      const { signature } = await rpc.signMessage({ msg });

      // verify we have permission to verify a message
      await rpc.verifyMessage({ msg, signature });

      // verify we have permissions to create a 1sat invoice
      const { rHash } = await rpc.addInvoice({ value: "1" });

      // verify we have permission to lookup invoices
      await rpc.lookupInvoice({ rHash });

      // listen for payments from LND
      this.listenForPayments(rpc, pubkey);

      // store this rpc connection in the in-memory list
      this._lndNode = rpc;

      // return this node's token for future requests
      console.log("connected", { pubkey });
      return { token, pubkey };
    } catch (err) {
      // remove the connection from the cache since it is not valid
      if (this._lndNode) {
        this._lndNode = null;
      }
      throw err;
    }
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
      await this.connect(host);
    } catch (error) {
      // the token will not be cached
      console.error(`Failed to reconnect to LND node ${host}`);
    }
  }

  /**
   * listen for payments made to the node. When a payment is settled, emit
   * the `invoicePaid` event to notify listeners of the NodeManager
   */
  async listenForPayments(rpc: LnRpc, pubkey: string) {
    const stream = rpc.subscribeInvoices();
    stream.on("data", (invoice) => {
      console.log("invoice created");
      if (invoice.settled) {
        console.log("payment recieved");

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
