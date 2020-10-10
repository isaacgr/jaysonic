const WsClientProtocol = require("./ws");

class WsBrowserClientProtocol extends WsClientProtocol {
  setConnector() {
    const { protocols } = this.factory.options;
    this.connector = new window.WebSocket(this.url, protocols);
  }

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

  handleNotification(message) {
    this.factory.dispatchEvent(
      new CustomEvent(message.method, { detail: message })
    );
  }
}

module.exports = WsBrowserClientProtocol;