const http = require("http");
const JsonRpcServerFactory = require(".");
const HttpServerProtocol = require("./protocol/http");
const { errorToStatus } = require("../constants");

/**
 * Creates instance of HttpServerFactory
 * @extends JsonRpcServerFactory
 */
class HttpServerFactory extends JsonRpcServerFactory {
  /** @inheritdoc */
  setServer() {
    this.server = new http.Server();
  }

  /** @inheritdoc */
  buildProtocol() {
    this.server.on("connection", (client) => {
      this.connectedClients.push(client);
      this.emit("clientConnected", client);
      client.on("close", () => {
        this.emit("clientDisconnected");
      });
      client.on("end", () => {
        this.emit("clientDisconnected");
      });
    });
    this.server.on("request", (request, response) => {
      this.pcolInstance = new HttpServerProtocol(
        this,
        request,
        response,
        this.options.version,
        this.options.delimiter
      );
      this.pcolInstance.clientConnected();
    });
  }

  /**
   * Set response header and response code
   * @param {object} options
   * @param {class} options.response Http response instance
   * @param {boolean} options.notification Inidicate if setting header for notification
   * @private
   */
  _setResponseHeader({ response, errorCode, notification }) {
    let statusCode = 200;
    if (notification) {
      statusCode = 204;
    }
    const header = {
      "Content-Type": "application/json"
    };
    if (errorCode) {
      statusCode = errorToStatus[String(errorCode)];
    }
    response.writeHead(statusCode, header);
  }
}

module.exports = HttpServerFactory;
