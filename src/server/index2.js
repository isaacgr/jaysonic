const EventEmitter = require("events");

/**
 * @class JsonRpcServerFactory
 * @extends require('events').EventEmitter
 * @param {Object} [host] host IP to connect with
 * @param {Object} [host] host port to connect with
 * @param {Object} [options]
 * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
 * @param {String} [options.delimiter="\n"] delimiter to use for requests
 * @param {Boolean} [options.exlusive=false] disallow port sharing
 * @return {Client}
 */
class JsonRpcServerFactory extends EventEmitter {
  constructor(options) {
    super();
    if (!(this instanceof JsonRpcServerFactory)) {
      return new JsonRpcServerFactory(options);
    }

    const defaults = {
      host: "127.0.0.1",
      port: 8100,
      exclusive: false,
      version: "2.0",
      delimiter: "\n"
    };

    this.options = {
      ...defaults,
      ...(options || {})
    };

    this.methods = {};
    this.connectedClients = [];
    this.listening = false;
  }

  listen() {
    return new Promise((resolve, reject) => {
      if (this.listening) {
        // not having this caused MaxEventListeners error
        return reject(Error("server already listening"));
      }
      const { host, port, exclusive } = this.options;
      this.setServer();
      this.server.listen({ host, port, exclusive });
      this.server.on("listening", () => {
        this.listening = true;
        this.buildProtocol();
        resolve({
          host: this.server.address().address,
          port: this.server.address().port
        });
      });
      this.setupListeners();
    });
  }

  setupListeners() {
    this.on("error", (error) => {
      this.listening = false;
      throw error;
    });
    this.server.on("error", (error) => {
      this.listening = false;
      throw error;
    });
    this.server.on("close", () => {
      this.listening = false;
    });
  }

  close() {
    this.listening = false;
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
        }
        resolve();
      });
    });
  }

  // add the method and its associated callback to the object
  method(name, cb) {
    this.methods[name] = cb;
  }

  onNotify(method, cb) {
    this.on(method, cb);
  }

  removeOnNotify(method, cb) {
    this.removeListener(method, cb);
  }

  removeAllOnNotify(method) {
    this.removeAllListeners([method]);
  }

  notify() {
    throw new Error("function must be overwritten in subclass");
  }

  buildProtocol() {
    throw new Error("function must be overwritten in subclass");
  }

  clientConnected() {
    throw new Error("function must be overwritten in subclass");
  }

  clientDisconnected() {
    throw new Error("function must be overwritten in subsclass");
  }
}

module.exports = JsonRpcServerFactory;

/**
 * HTTP server constructor
 * @type ServerHTTP
 * @static
 */
JsonRpcServerFactory.http = require("./http");

/**
 * TCP server constructor
 * @type ServerTCP
 * @static
 */
JsonRpcServerFactory.tcp = require("./tcp2");

/**
 * WS server constructor
 * @type ServerWS
 * @static
 */
JsonRpcServerFactory.ws = require("./ws");
