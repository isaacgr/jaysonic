const WebSocket = require("ws");
const JsonRpcServerFactory = require(".");
const WSServerProtocol = require("./protocol/ws");

/**
 * Constructor for Jsonic WS client
 * @class WSClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return WSClient
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

  /**
   * Returns list of error objects if there was an error sending to any client
   * Otherwise Returns true if the entire data was sent successfully
   * Returns false if all or part of the data was not
   */
  sendNotifications(response) {
    if (this.connectedClients.length === 0) {
      return [Error("No clients connected")];
    }
    return this.connectedClients.map((client) => {
      try {
        return client.send(
          JSON.stringify(JSON.parse(response)) + this.options.delimiter
        );
      } catch (e) {
        // possibly client disconnected
        return e;
      }
    });
  }
}

module.exports = WSServer;
