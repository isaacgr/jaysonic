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
      host: "127.0.0.1",
      path: null,
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
    this.on("clientConnected", client => cb({
      host: client.remoteAddress,
      port: client.remotePort
    }));
  }

  clientDisconnected(cb) {
    this.on("clientDisconnected", (client) => {
      const clientIndex = this.connectedClients.findIndex(c => client === c);
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

  notify(notifications) {
    if (notifications.length === 0 || !typeof notifications === Array) {
      throw new Error("Invalid arguments");
    }
    const responses = notifications.map(([method, params]) => {
      const response = this.options.version === "2.0"
        ? {
          jsonrpc: "2.0",
          method,
          params,
          delimiter: this.options.delimiter
        }
        : {
          method,
          params,
          delimiter: this.options.delimiter
        };
      return response;
    });
    if (responses.length === 0) {
      throw new Error("Unable to generate a response object");
    }
    let response;
    if (responses.length === 1) {
      response = formatResponse(responses[0]);
    } else {
      response = "[";
      responses.forEach((res, idx) => {
        response += formatResponse(res);
        response += idx === responses.length - 1 ? "" : ",";
      });
      response += "]";
    }
    /**
     * Returns list of error objects if there was an error sending to any client
     */
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
