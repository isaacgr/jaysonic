const net = require("net");
const Server = require(".");
const { formatResponse } = require("../functions");
const { TCPServerProtocol } = require("./protocol/tcp");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */
class TCPServer extends Server {
  constructor(options) {
    super(options);
    this.connectedClients = [];
    this.initServer();
  }

  initServer() {
    this.server = new net.Server();
  }

  handleData() {
    this.server.on("connection", (client) => {
      this.connectedClients.push(client);
      this.emit("clientConnected", client);
      const tcpServerProtocol = new TCPServerProtocol(
        this,
        client,
        this.options.delimiter
      );
      tcpServerProtocol.clientConnected();
    });
  }

  clientConnected(cb) {
    this.on("clientConnected", (client) => {
      cb({
        host: client.remoteAddress,
        port: client.remotePort
      });
    });
  }

  clientDisconnected(cb) {
    this.on("clientDisconnected", (client) => {
      const clientIndex = this.connectedClients.findIndex((c) => client === c);
      if (clientIndex === -1) {
        return cb(`Unknown client ${JSON.stringify(client)}`);
      }
      const [deletedClient] = this.connectedClients.splice(clientIndex, 1);
      return cb({
        host: deletedClient.remoteAddress,
        port: deletedClient.remotePort
      });
    });
  }

  // only available for TCP and ws server
  notify(notifications) {
    if (notifications.length === 0 || !Array.isArray(notifications)) {
      throw new Error("Invalid arguments");
    }
    const responses = notifications.map(([method, params]) => {
      if (!method && !params) {
        throw new Error("Unable to generate a response object");
      }
      const response =
        this.options.version === "2.0"
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
    if (this.connectedClients.length === 0) {
      return [new Error("No clients connected")];
    }
    return this.connectedClients.map((client) => {
      try {
        return client.write(
          JSON.stringify(JSON.parse(response)) + this.options.delimiter
        );
      } catch (e) {
        // possibly client disconnected
        return e;
      }
    });
  }
}

module.exports = TCPServer;
