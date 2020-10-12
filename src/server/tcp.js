const net = require("net");
const JsonRpcServerFactory = require(".");
const TCPServerProtocol = require("./protocol/tcp");

/**
 * Creates an instance of TcpServerFactory
 * @extends JsonRpcServerFactory
 */
class TcpServerFactory extends JsonRpcServerFactory {
  /** @inheritdoc */
  setServer() {
    this.server = new net.Server();
  }

  /** @inheritdoc */
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
   * Send notification to client
   *
   * @param {class} client Client instance
   * @param {string} response Stringified JSON-RPC message to sent to client
   * @throws Will throw an error if client is not defined
   */
  sendNotification(client, response) {
    return client.write(
      JSON.stringify(JSON.parse(response)) + this.options.delimiter
    );
  }
}

module.exports = TcpServerFactory;
