const WsClientProtocol = require("./ws");

/**
 * Creates an instance of WsBrowserClientProtocol
 *
 * @extends WsClientProtocol
 */
class WsBrowserClientProtocol extends WsClientProtocol {
  /**
   * Set the `connector` attribute for the protocol instance. The connector is essentially the
   * socket instance for the client.
   *
   * For the [WsBrowserClientProtocol]{@link WsBrowserClientProtocol} this is `window.WebSocket()`
   */
  setConnector() {
    const { protocols } = this.factory.options;
    this.connector = new window.WebSocket(this.url, protocols);
    this.connector.write = this.connector.send; // tcp uses .write(), ws uses .send()
  }

  /** @inheritdoc */
  gotNotification(message) {
    this.factory.dispatchEvent(
      new CustomEvent(message.method, { detail: message })
    );
  }
}

module.exports = WsBrowserClientProtocol;
