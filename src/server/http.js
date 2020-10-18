const http = require("http");
const https = require("https");
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
  constructor(options) {
    super(options);
    this.scheme = this.options.scheme || "http";
  }

  setServer() {
    if (this.scheme === "http") {
      this.server = new http.Server();
    } else if (this.scheme === "https") {
      this.server = new https.Server();
    } else {
      throw Error("Invalid scheme");
    }
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
