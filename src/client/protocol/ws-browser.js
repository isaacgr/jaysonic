const WsClientProtocol = require("./ws");

/**
 * Creates an instance of WsBrowserClientProtocol
 *
 * @extends WsClientProtocol
 */
class WsBrowserClientProtocol extends WsClientProtocol {
  /**
   * Set the <code>connector</code> attribute for the protocol instance. The connector is essentially the
   * socket instance for the client.
   *
   * For the [WsBrowserClientProtocol]{@link WsBrowserClientProtocol} this is <code>window.WebSocket()</code>
   */
  setConnector() {
    const { protocols } = this.factory.options;
    this.connector = new window.WebSocket(this.url, protocols);
  }

  /** @inheritdoc */
  handleBatch(message) {
    // check if any requests are notifications
    message.forEach((res) => {
      if (res && res.method && !res.id) {
        this.factory.dispatchEvent(
          new CustomEvent(res.method, { detail: res })
        );
      }
    });
    this.gotBatchResponse(message);
  }

  /** @inheritdoc */
  handleNotification(message) {
    this.factory.dispatchEvent(
      new CustomEvent(message.method, { detail: message })
    );
  }
}

module.exports = WsBrowserClientProtocol;
