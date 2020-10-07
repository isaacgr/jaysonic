const JsonRpcClientProtocol = require("./base");
const WebSocket = require("ws");

class WsClientProtocol extends JsonRpcClientProtocol {
  constructor(factory, version, delimiter) {
    super(factory, version, delimiter);
    this.url = this.factory.url;
  }
  connect() {
    return new Promise((resolve, reject) => {
      const { perMessageDeflate } = this.factory.options;
      this.connector = new WebSocket(this.url, perMessageDeflate);
      this.connector.onopen = (event) => {
        this.connector.write = this.connector.send; // tcp uses .write(), ws uses .send()
        this.listen();
        resolve(event);
      };
      this.connector.onerror = (error) => {
        // let the onclose event handle it otherwise
        if (error.error.code !== "ECONNREFUSED") {
          reject(error);
        }
      };
      this.connector.onclose = (code, message) => {
        if (this.connector.__clientClosed) {
          console.log(
            `Client closed connection. Code[${code}]. Reason [${message}]`
          );
        } else if (this.factory.remainingRetries) {
          this.factory.remainingRetries -= 1;
          console.error(
            `Connection failed. ${this.factory.remainingRetries} attempts left.`
          );
          setTimeout(() => {
            this.connect();
          }, this.factory.connectionTimeout);
        } else {
          this.factory.pcolInstance = undefined;
          reject({
            error: {
              code: "ECONNREFUSED",
              message: `connection refused ${this.url}`
            }
          });
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
    this.connector.onmessage = (message) => {
      this.messageBuffer.push(message.data);
      this._waitForData(message.data);
    };
  }
}

module.exports = WsClientProtocol;
