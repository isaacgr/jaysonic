const WebSocket = require("ws");
const JsonRpcClientProtocol = require("./base");

/**
 * Creates and instance of WsClientProtocol
 *
 * @extends JsonRpcClientProtocol
 * @requires ws
 */
class WsClientProtocol extends JsonRpcClientProtocol {
  /** @inheritdoc */
  /** @property {string} url The websocket URL to connect to, i.e. `ws://127.0.0.1:8100` */
  constructor(factory, version, delimiter) {
    super(factory, version, delimiter);
    this.url = this.factory.url;
  }

  /**
   * Set the `connector` attribute for the protocol instance. The connector is essentially the
   * socket instance for the client.
   *
   * For the [WsClientProtocol]{@link WsClientProtocol} this is `WebSocket()`
   */
  setConnector() {
    const { perMessageDeflate } = this.factory.options;
    this.connector = new WebSocket(this.url, perMessageDeflate);
    this.connector.write = this.connector.send; // tcp uses .write(), ws uses .send()
  }

  /**
   * @inheritdoc
   */
  connect() {
    return new Promise((resolve, reject) => {
      const retryConnection = () => {
        this.setConnector();
        this.connector.onopen = (event) => {
          this.listener = this.connector;
          this.listen();
          resolve(event);
        };
        this.connector.onerror = (error) => {
          // let the onclose event got it otherwise
          if (error.error && error.error.code !== "ECONNREFUSED") {
            reject(error);
          }
        };
        this.connector.onclose = (event) => {
          if (this.connector.__clientClosed) {
            // we dont want to retry if the client purposefully closed the connection
            console.log(
              `Client closed connection. Code [${event.code}]. Reason [${event.reason}].`
            );
          } else {
            if (this.factory.remainingRetries === 0) {
              this.factory.pcolInstance = undefined;
              reject(event);
            } else {
              this.factory.remainingRetries -= 1;
              console.error(
                `Connection failed. ${this.factory.remainingRetries} attempts left.`
              );
            }
            setTimeout(() => {
              retryConnection();
            }, this.factory.connectionTimeout);
          }
        };
      };
      return retryConnection();
    });
  }

  /** @inheritdoc */
  end(code, reason) {
    this.factory.pcolInstance = undefined;
    this.connector.__clientClosed = true; // used to determine if client initiated close event
    this.connector.close(code, reason);
  }

  /** @inheritdoc */
  listen() {
    this.listener.onmessage = (message) => {
      this.messageBuffer.push(message.data);
      this._waitForData(message.data);
    };
  }
}

module.exports = WsClientProtocol;
