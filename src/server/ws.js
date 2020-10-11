const WebSocket = require("ws");
const JsonRpcServerFactory = require(".");
const WSServerProtocol = require("./protocol/ws");

/**
 * Constructor for Jsonic WS client
 * @class WSServer
 * @constructor
 * @extends JsonRpcServerFactory
 * @param {Object} [options] optional settings for client
 * @return WSServer
 */
class WSServer extends JsonRpcServerFactory {
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

  setSever() {
    this.server = new WebSocket.Server(this.options);
  }

  /**
   * WS server needs to override listen method from parent
   * since the ws library starts listening on instantiation
   */
  listen() {
    return new Promise((resolve, reject) => {
      if (this.listening) {
        // not having this caused MaxEventListeners error
        return reject(Error("server already listening"));
      }
      this.setSever();
      this.listening = true;
      this.pcolInstance = this.buildProtocol();
      try {
        resolve({
          host: this.options.host,
          port: this.options.port,
          path: this.options.path
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  buildProtocol() {
    this.server.on("connection", (client) => {
      this.emit("clientConnected", client);
      this.connectedClients.push(client);
      this.pcolInstance = new WSServerProtocol(
        this,
        client,
        this.options.version,
        this.options.delimiter
      );
      this.pcolInstance.clientConnected();
    });
  }

  sendNotification(client, response) {
    return client.send(
      JSON.stringify(JSON.parse(response)) + this.options.delimiter
    );
  }
}

module.exports = WSServer;
