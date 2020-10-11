const net = require("net");
const JsonRpcServerFactory = require(".");
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

  sendNotification(client, response) {
    return client.write(
      JSON.stringify(JSON.parse(response)) + this.options.delimiter
    );
  }
}

module.exports = TcpServerFactory;
