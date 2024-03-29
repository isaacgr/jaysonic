const WebSocket = require("ws");
const JsonRpcServerFactory = require(".");
const WSServerProtocol = require("./protocol/ws");

/**
 * Creates and instance of WsServerFactory
 * @extends JsonRpcServerFactory
 * @requires ws
 */
class WsServerFactory extends JsonRpcServerFactory {
  constructor(options) {
    super(options);

    const defaults = {
      path: null,
      // all the ws options on the github page
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        }
      }
    };

    this.options = {
      ...defaults,
      ...(this.options || {})
    };

    this.protocol = WSServerProtocol;
  }

  /** @inheritdoc */
  setSever() {
    this.server = new WebSocket.Server(this.options);
  }

  /** @inheritdoc */
  listen() {
    return new Promise((resolve, reject) => {
      if (this.listening) {
        // not having this caused MaxEventListeners error
        return reject(Error("server already listening"));
      }
      const { host, port, path } = this.options;
      this.setSever();
      this._setupListeners(reject);
      this.server.on("listening", () => {
        this.listening = true;
        this.buildProtocol();
        resolve({
          host,
          port,
          path
        });
      });
    });
  }

  /** @inheritdoc */
  buildProtocol() {
    this.server.on("connection", (client) => {
      const pcol = new this.protocol(
        this,
        client,
        this.options.version,
        this.options.delimiter
      );
      pcol.clientConnected();
      this.clients.push(pcol);
      this.clientConnected(pcol);
      this.clientConnected(pcol);
      client.on("close", () => {
        this.clientDisconnected(pcol);
      });
    });
  }

  /** @inheritdoc */
  _removeClients() {
    for (const pcol of this.clients) {
      pcol.client.close();
    }
    this.clients = [];
  }

  /**
   * Send notification to client
   *
   * @param {class} client Client instance
   * @param {string} response Stringified JSON-RPC message to sent to client
   * @throws Will throw an error if client is not defined
   */
  sendNotification(client, response) {
    return client.send(response);
  }
}

module.exports = WsServerFactory;
