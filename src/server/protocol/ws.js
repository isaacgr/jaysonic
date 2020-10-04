const JsonRpcServerProtocol = require("./base");

class WSServerProtocol extends JsonRpcServerProtocol {
  constructor(factory, client, delimiter) {
    super(factory, client, delimiter);
    this.event = "message"; // ws uses 'message', tcp uses 'data'
    this.client.write = this.client.send; // ws uses .send(), tcp uses .write()
  }
}

module.exports = { WSServerProtocol };
