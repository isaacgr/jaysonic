const net = require("net");
const Server = require(".");
const { formatResponse } = require("../functions");
const { TCPServerProtocol } = require("../ServerProtocol");

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

  // only available for TCP server
  notify(method, params) {
    let response;
    if (this.options.version === "2.0") {
      response = {
        jsonrpc: this.options.version,
        method,
        params
      };
    } else {
      response = {
        method,
        result: params,
        error: null
      };
    }
    try {
      this.connectedClients.forEach((client) => {
        client.write(formatResponse(response) + this.options.delimiter);
      });
    } catch (e) {
      // was unable to send data to client, possibly disconnected
      this.emit("error", e);
    }
  }
}

module.exports = TCPServer;
