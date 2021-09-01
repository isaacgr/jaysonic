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
      this.setSever();
      this.listening = true;
      this.buildProtocol();
      resolve({
        host: this.options.host,
        port: this.options.port,
        path: this.options.path
      });
      this._setupListeners();
    });
  }

  /** @inheritdoc */
  buildProtocol() {
    this.server.on("connection", (client) => {
      const pcol = new WSServerProtocol(
        this,
        client,
        this.options.version,
        this.options.delimiter
      );
      pcol.clientConnected();
      this.clients.push(pcol);
      this.clientConnected(client);
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
