const net = require("net");
const JsonRpcClientProtocol = require("./base");

class TcpClientProtocol extends JsonRpcClientProtocol {
  setConnector() {
    this.connector = new net.Socket();
  }
}

module.exports = TcpClientProtocol;
