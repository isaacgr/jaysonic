const JsonRpcServerProtocol = require("./base");

/**
 * Creates instance of HttpServerProtocol
 * @extends JsonRpcServerProtocol
 *
 */
class HttpServerProtocol extends JsonRpcServerProtocol {
  /** @inheritdoc */
  /**
   * @property {class} response HTTP response object
   *
   */
  constructor(factory, client, response, version, delimiter) {
    super(factory, client, version, delimiter);
    this.response = response;
  }

  /**
   * Send message to the client. If a notification is passed, then
   * a 204 response code is sent.
   *
   * @param {string} message Stringified JSON-RPC message object
   * @param {boolean} notification Indicates if message is a notification
   */
  writeToClient(message, notification) {
    if (notification) {
      this.factory._setResponseHeader({
        response: this.response,
        notification: true
      });
      this.response.end();
      return;
    }
    this.factory._setResponseHeader({ response: this.response });
    this.response.write(message, () => {
      this.response.end();
    });
  }

  /**
   * Calls `emit` on factory with the event name being `message.method` and
   * the date being `message`. Responds to client.
   *
   * @param {string} message Stringified JSON-RPC message object
   */
  gotNotification(message) {
    super.gotNotification(message.method, message);
    this.writeToClient(message, true);
  }

  /** @inheritdoc */
  clientConnected() {
    this.client.on(this.event, (data) => {
      this.messageBuffer.push(data);
    });
    this.client.on("end", () => {
      this._waitForData();
    });
  }
}

module.exports = HttpServerProtocol;
