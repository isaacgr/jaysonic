const JsonRpcServerProtocol = require("./base");

class HttpServerProtocol extends JsonRpcServerProtocol {
  constructor(factory, client, response, delimiter) {
    super(factory, client, delimiter);
    this.response = response;
  }

  writeToClient(message, notification) {
    if (notification) {
      this.factory.setResponseHeader({
        response: this.response,
        notification: true
      });
      this.response.end();
      return;
    }
    this.factory.setResponseHeader({ response: this.response });
    this.response.write(message, () => {
      this.response.end();
    });
  }

  clientConnected() {
    this.client.on(this.event, (data) => {
      this.messageBuffer.push(data);
    });
    this.client.on("end", () => {
      this._waitForData();
    });
  }

  sendError(error) {
    this.factory.setResponseHeader({
      response: this.response,
      errorCode: JSON.parse(error).error.code || 500
    });
    this.response.write(error, () => {
      this.response.end();
    });
  }
}

module.exports = { HttpServerProtocol };
