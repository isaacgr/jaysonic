const JsonRpcServerProtocol = require("./base");

/**
 * Creates instance of WsServerProtocol
 * @extends JsonRpcServerProtocol
 */
class WsServerProtocol extends JsonRpcServerProtocol {
  /**
   * In addition to the params and properties for [JsonRpcServerProtocol]{@link JsonRpcServerProtocol}
   * the WsServerProtocol has the following properties:
   *
   * @property {string} event HTTP response object
   * @property {object} client.write  Overrides `client.write` method to use `client.send` for Websocket
   */
  constructor(factory, client, version, delimiter) {
    super(factory, client, version, delimiter);
    this.event = "message"; // ws uses 'message', tcp uses 'data'
    this.client.write = this.client.send; // ws uses .send(), tcp uses .write()
  }
}

module.exports = WsServerProtocol;
