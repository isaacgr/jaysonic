const net = require("net");
const JsonRpcClientProtocol = require("./base");

/**
 * Creates an instance of TcpClientProtocol
 *
 * @extends JsonRpcClientProtocol
 * @requires net
 */
class TcpClientProtocol extends JsonRpcClientProtocol {
  /**
   * Set the <code>connector</code> attribute for the [JsonRpcClientProtocol]{@link JsonRpcClientProtocol} instance. The connector is essentially the
   * socket instance for the client.
   *
   * For the [TcpClientProtocol]{@link TcpClientProtocol} this is <code>net.Socket()</code>
   */
  setConnector() {
    this.connector = new net.Socket();
  }
}

module.exports = TcpClientProtocol;
