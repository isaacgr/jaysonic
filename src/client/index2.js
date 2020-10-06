const EventEmitter = require("events");

/**
 * @class Client
 * @extends require('events').EventEmitter
 * @param {Object} [server] object with host and port of server
 * @param {Object} [options]
 * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
 * @param {String} [options.delimiter="\n"] delimiter to use for requests
 * @param {Number} [options.timeout=30] timeout for request
 * @return {Client}
 */
class JsonRpcClientFactory extends EventEmitter {
  constructor(options) {
    super();
    if (!(this instanceof JsonRpcClientFactory)) {
      return new JsonRpcClientFactory(options);
    }

    const defaults = {
      host: "127.0.0.1",
      port: "8100",
      version: "2.0",
      delimiter: "\n",
      timeout: 30,
      connectionTimeout: 5000,
      retries: 2
    };

    this.pcolInstance = undefined;
    this.timeouts = {};

    this.options = {
      ...defaults,
      ...(options || {})
    };
    this.requestTimeout = this.options.timeout * 1000;
    this.remainingRetries = this.options.retries;

    this.server = { host: this.options.host, port: this.options.port };
  }

  connect() {
    throw new Error("function must be overwritten in subclass");
  }

  end() {
    throw new Error("function must be overwritten in subclass");
  }

  subscribe() {
    throw new Error("function must be overwritten in subsclass");
  }

  unsubscribe() {
    throw new Error("function must be overwritten in subsclass");
  }

  unsubscribeAll() {
    throw new Error("function must be overwritten in subsclass");
  }

  request() {
    return this.pcolInstance.request();
  }

  batch(requests) {
    return this.pcolInstance.batch(requests);
  }

  serverDisconnected(cb) {
    this.on("serverDisconnected", cb);
  }

  cleanUp(ids) {
    // clear pending timeouts for these request ids
    clearTimeout(this.timeouts[ids]);
    delete this.listeners[ids];
    delete this.timeouts[ids];
  }
}
module.exports = JsonRpcClientFactory;

/**
 * TCP client constructor
 * @type ClientTcp
 * @static
 */
JsonRpcClientFactory.tcp = require("./tcp");

/**
 * HTTP client constructor
 * @type ClientHTTP
 * @static
 */
JsonRpcClientFactory.http = require("./http");

/**
 * WebSoket client constructor
 * @type ClientWS
 * @static
 */
JsonRpcClientFactory.ws = require("./ws");
