const JsonRpcServerProtocol = require("./base");

class WSServerProtocol extends JsonRpcServerProtocol {
  constructor(factory, client, delimiter) {
    super(factory, client, delimiter);
    this.event = "message";
  }

  writeToClient(message) {
    this.client.send(message);
  }
}

module.exports = { WSServerProtocol };
