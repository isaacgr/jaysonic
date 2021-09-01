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
   * @property {file} key The private SSL key file
   * @property {file} cert The SSL certificate file
   */
  constructor(options) {
    super(options);
    this.scheme = this.options.scheme || "http";
    this.key = this.options.key;
    this.cert = this.options.cert;
  }

  /** @inheritdoc */
  setServer() {
    if (this.scheme === "http") {
      this.server = new http.Server();
    } else if (this.scheme === "https") {
      this.server = new https.Server({
        key: this.key,
        cert: this.cert
      });
    } else {
      throw Error("Invalid scheme");
    }
  }

  /** @inheritdoc */
  buildProtocol() {
    this.server.on("connection", (client) => {
      this.emit("clientConnected", client);
      client.on("close", () => {
        this.emit("clientDisconnected");
      });
      // maybe need .on('end') event listener?
    });
    this.server.on("request", (request, response) => {
      const pcol = new HttpServerProtocol(
        this,
        request,
        response,
        this.options.version,
        this.options.delimiter
      );
      pcol.clientConnected();
      this.clients.push(pcol);
    });
  }
}

module.exports = HttpServerFactory;
