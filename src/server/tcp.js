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
      const pcol = new TCPServerProtocol(
        this,
        client,
        this.options.version,
        this.options.delimiter
      );
      pcol.clientConnected();
      this.clients.push(pcol);
      this.clientConnected(pcol);
      client.on("end", () => {
        this.clientDisconnected(pcol);
      });
    });
  }
}

module.exports = TcpServerFactory;
