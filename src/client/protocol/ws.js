const WebSocket = require("ws");
const JsonRpcClientProtocol = require("./base");

class WsClientProtocol extends JsonRpcClientProtocol {
  constructor(factory, version, delimiter) {
    super(factory, version, delimiter);
    this.url = this.factory.url;
  }

  setConnector() {
    const { perMessageDeflate } = this.factory.options;
    this.connector = new WebSocket(this.url, perMessageDeflate);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.setConnector();
      this.connector.onopen = (event) => {
        this.connector.write = this.connector.send; // tcp uses .write(), ws uses .send()
        this.listener = this.connector;
        this.listen();
        resolve(event);
      };
      this.connector.onerror = (error) => {
        // let the onclose event handle it otherwise
        if (error.error.code !== "ECONNREFUSED") {
          reject(error);
        }
      };
      this.connector.onclose = (event) => {
        if (this.connector.__clientClosed) {
          console.log(
            `Client closed connection. Code[${event.code}]. Reason [${event.message}]`
          );
        } else {
          if (this.factory.remainingRetries === 0) {
            reject(event);
          }
          this.factory.remainingRetries -= 1;
          console.error(
            `Connection failed. ${this.factory.remainingRetries} attempts left.`
          );
          setTimeout(() => {
            this.connect();
          }, this.factory.connectionTimeout);
        }
      };
    });
  }

  end(code, reason) {
    this.factory.pcolInstance = undefined;
    this.connector.__clientClosed = true;
    this.connector.close(code, reason);
  }

  listen() {
    this.listener.onmessage = (message) => {
      this.messageBuffer.push(message.data);
      this._waitForData(message.data);
    };
  }
}

module.exports = WsClientProtocol;
