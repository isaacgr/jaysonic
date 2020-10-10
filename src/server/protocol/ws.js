const JsonRpcServerProtocol = require("./base");

class WSServerProtocol extends JsonRpcServerProtocol {
  constructor(factory, client, version, delimiter) {
    super(factory, client, version, delimiter);
    this.event = "message"; // ws uses 'message', tcp uses 'data'
    this.client.write = this.client.send; // ws uses .send(), tcp uses .write()
  }
}

module.exports = WSServerProtocol;
