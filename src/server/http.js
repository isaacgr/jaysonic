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
    this.protocol = HttpServerProtocol;
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
    });
  }

  /**
   * Called when client receives a `connection` event.
   *
   * @param {stream.Duplex} client Instance of `stream.Duplex`
   * @returns {stream.Duplex} Returns an instance of `stream.Duplex`
   */
  clientConnected(client) {
    return client;
  }

  /**
   * Called when client disconnects from server.
   *
   * @param {stream.Duplex} client Instance of `stream.Duplex`
   * @returns {object|error} Returns an object of {host, port} for the given protocol instance, or {error}
   * if there was an error retrieving the client
   */
  clientDisconnected(client) {
    return this.removeDisconnectedClient(client);
  }

  /**
   * Removes disconnected client from `this.clients` list
   *
   * @param {stream.Duplex} client Instance of `stream.Duplex`
   * @returns {object|error} Returns an object of {host, port} for the given protocol instance, or {error}
   * if there was an error retrieving the client
   */
  removeDisconnectedClient(client) {
    const clientIndex = this.clients.findIndex(c => c === client);
    if (clientIndex === -1) {
      return {
        error: `Unknown client ${JSON.stringify(client)}`
      };
    }
    const [disconnectedClient] = this.clients.splice(clientIndex, 1);
    return disconnectedClient;
  }
}

module.exports = HttpServerFactory;
