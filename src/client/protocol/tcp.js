const net = require("net");
const JsonRpcClientProtocol = require("./base");

/**
 * Creates an instance of TcpClientProtocl
 *
 * @extends JsonRpcClientProtocol
 */
class TcpClientProtocol extends JsonRpcClientProtocol {
  /**
   * Set the `connector` attribute for the protocol instance. The connector is essentially the
   * socket instance for the client.
   *
   * For the TcpClientProtocl this is `net.Socket()`
   */
  setConnector() {
    this.connector = new net.Socket();
  }
}

module.exports = TcpClientProtocol;
