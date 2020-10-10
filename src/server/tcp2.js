const net = require("net");
const JsonRpcServerFactory = require("./index2");
const TCPServerProtocol = require("./protocol/tcp");

class TcpServerFactory extends JsonRpcServerFactory {
  setServer() {
    this.server = new net.Server();
  }

  buildProtocol() {
    this.server.on("connection", (client) => {
      this.connectedClients.push(client);
      this.emit("clientConnected", client);
      this.pcolInstance = new TCPServerProtocol(
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
