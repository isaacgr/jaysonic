const http = require("http");
const JsonRpcServerFactory = require(".");
const HttpServerProtocol = require("./protocol/http");
const { errorToStatus } = require("../constants");

/**
 * Constructor for Jsonic HTTP server
 * @class HTTPServer
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for server
 * @return HTTPServer
 */
class HTTPServer extends JsonRpcServerFactory {
  setServer() {
    this.server = new http.Server();
  }

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

  setResponseHeader({ response, errorCode, notification }) {
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

module.exports = HTTPServer;
