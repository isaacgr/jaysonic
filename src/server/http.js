const http = require("http");
const https = require("https");
const JsonRpcServerFactory = require(".");
const HttpServerProtocol = require("./protocol/http");

/**
 * Creates instance of HttpServerFactory
 * @extends JsonRpcServerFactory
 */
class HttpServerFactory extends JsonRpcServerFactory {
  /**
   *
   * In addition to the params and properties for [JsonRpcServerFactory]{@link JsonRpcServerFactory}
   * the WsServerProtocol has the following properties:
   *
   * @property {'http'|'https'} scheme The scheme to allow connections with
   * @property {object} sslOptions Any of the ssl options for the http server according to https://nodejs.org/api/tls.html#tls_tls_createsecurecontext_options
   */
  constructor(options) {
    super(options);
    this.scheme = this.options.scheme || "http";
    this.sslOptions = this.options.ssl;
    this.protocol = HttpServerProtocol;
    this.pendingRequests = [];
  }

  /** @inheritdoc */
  setServer() {
    if (this.scheme === "http") {
      this.server = new http.Server();
    } else if (this.scheme === "https") {
      this.server = new https.Server({
        ...this.sslOptions
      });
    } else {
      throw Error("Invalid scheme");
    }
  }

  /** @inheritdoc */
  buildProtocol() {
    this.server.on("connection", (client) => {
      this.clientConnected(client);
      this.clients.push(client);
      client.on("close", () => {
        this.clientDisconnected(client);
      });
      // maybe need .on('end') event listener?
    });
    this.server.on("request", (request, response) => {
      const pcol = new this.protocol(
        this,
        request,
        response,
        this.options.version,
        this.options.delimiter
      );
      pcol.clientConnected();
      this.pendingRequests.push(pcol);
    });
  }

  /**
   * Called when the server receives a `connection` event.
   *
   * @param {net.Socket} client Instance of `net.Socket`
   * @returns {net.Socket} Returns an instance of `net.Socket`
   */
  clientConnected(client) {
    return client;
  }
}

module.exports = HttpServerFactory;
