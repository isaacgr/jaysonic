const JsonRpcServerProtocol = require("./base");

class HttpServerProtocol extends JsonRpcServerProtocol {
  constructor(factory, client, response, version, delimiter) {
    super(factory, client, version, delimiter);
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

  handleNotification(message) {
    this.factory.emit(message.method, message);
    this.writeToClient(message, true);
  }

  clientConnected() {
    this.client.on(this.event, (data) => {
      this.client.on("end", () => {
        this._waitForData(data);
      });
    });
  }

  _waitForData(data) {
    try {
      const result = this.validateRequest(data);
      const isMessage = this.maybeHandleRequest(result);
      if (isMessage) {
        this.handleRequest(result);
      }
    } catch (e) {
      this.handleError(e);
    }
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

module.exports = HttpServerProtocol;
