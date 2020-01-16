const WebSocket = require("ws");
const Server = require(".");
const { formatResponse } = require("../functions");
const { WSServerProtocol } = require("../ServerProtocol");

/**
 * Constructor for Jsonic WS client
 * @class WSClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return WSClient
 */
class WSServer extends Server {
  constructor(options) {
    super(options);

    this.connectedClients = [];
    const defaults = {
      port: 8100,
      version: "2.0",
      delimiter: "\n",
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
      ...(options || {})
    };
  }

  listen() {
    /**
     * WS server needs to override listen method from parent
     * since the ws library starts listening on instantiation
     */
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocket.Server(this.options);
        this.handleData();
        this.handleError();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  handleData() {
    this.server.on("connection", (client) => {
      this.emit("clientConnected", client);
      this.connectedClients.push(client);
      const wsServerProtocol = new WSServerProtocol(
        this,
        client,
        this.options.delimiter
      );
      wsServerProtocol.clientConnected();
    });
  }

  clientConnected(cb) {
    this.on("clientConnected", (client) =>
      cb({
        host: client.remoteAddress,
        port: client.remotePort
      })
    );
  }

  clientDisconnected(cb) {
    this.on("clientDisconnected", (client) => {
      const clientIndex = this.connectedClients.findIndex((c) => client === c);
      if (clientIndex === -1) {
        return "unknown";
      }
      const [deletedClient] = this.connectedClients.splice(clientIndex, 1);
      return cb({
        host: deletedClient.remoteAddress,
        port: deletedClient.remotePort
      });
    });
  }

  // only available for TCP and ws server
  notify(method, params) {
    let response;
    if (this.options.version === "2.0") {
      response = {
        jsonrpc: "2.0",
        method: method,
        params: params,
        delimiter: this.options.delimiter
      };
    } else {
      response = {
        method: method,
        params: params,
        delimiter: this.options.delimiter
      };
    }
    try {
      this.connectedClients.forEach((client) => {
        client.send(formatResponse(response));
      });
    } catch (e) {
      // was unable to send data to client, possibly disconnected
      this.emit("error", e);
    }
  }
}

module.exports = WSServer;
