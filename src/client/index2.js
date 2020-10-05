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
class Client extends EventEmitter {
  constructor(options) {
    super();
    if (!(this instanceof Client)) {
      return new Client(options);
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
    this.listeners = {};

    this.options = {
      ...defaults,
      ...(options || {})
    };
    this.options.timeout = this.options.timeout * 1000;
    this.remainingRetries = this.options.retries;

    this.server = { host: this.options.host, port: this.options.port };
  }

  connect() {
    throw new Error("function must be overwritten in subclass");
  }

  end() {
    throw new Error("function must be overwritten in subclass");
  }

  request() {
    throw new Error("function must be overwritten in subclass");
  }

  batch() {
    throw new Error("function must be overwritten in subclass");
  }

  notify() {
    throw new Error("function must be overwritten in subsclass");
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

  serverDisconnected(cb) {
    this.on("serverDisconnected", cb);
  }

  cleanUp(ids) {
    // remove the batchResponse listener and clear pending
    // timeouts for these request ids
    try {
      this.removeListener("batchResponse", this.listeners[ids]);
    } catch (e) {
      // likely no batch response listener associated with the ids
    }
    clearTimeout(this.timeouts[ids]);
    delete this.listeners[ids];
    delete this.timeouts[ids];
  }
}
module.exports = Client;

/**
 * TCP client constructor
 * @type ClientTcp
 * @static
 */
Client.tcp = require("./tcp");

/**
 * HTTP client constructor
 * @type ClientHTTP
 * @static
 */
Client.http = require("./http");

/**
 * WebSoket client constructor
 * @type ClientWS
 * @static
 */
Client.ws = require("./ws");
