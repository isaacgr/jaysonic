const net = require("net");
const JsonRpcServerFactory = require("./index2");
const TCPServerProtocol = require("./protocol/tcp");
const { formatResponse, formatError } = require("../functions");

class TcpServerFactory extends JsonRpcServerFactory {
  setServer() {
    this.server = new net.Server();
  }

  buildProtocol() {
    this.server.on("connection", (client) => {
      this.connectedClients.push(client);
      this.emit("clientConnected", client);
      const tcpServerProtocol = new TCPServerProtocol(
        this,
        client,
        this.options.version,
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

  notify(notifications) {
    if (notifications.length === 0 || !Array.isArray(notifications)) {
      throw new Error("Invalid arguments");
    }
    const responses = notifications.map(([method, params]) => {
      if (!method && !params) {
        throw new Error("Unable to generate a response object");
      }
      const response = {
        method,
        params,
        delimiter: this.options.delimiter
      };
      if (this.options.version === "2.0") {
        response.jsonrpc = "2.0";
      }
      return response;
    });
    if (responses.length === 0) {
      throw new Error("Unable to generate a response object");
    }
    let response;
    if (responses.length === 1) {
      response = formatResponse(responses[0]);
    } else {
      // batch notification responses
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

module.exports = TcpServerFactory;
