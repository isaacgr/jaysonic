const EventEmitter = require("events");

/**
 * Creates an instance of JsonRpcClientFactory. This is the base factory which
 * all other factories inherit from.
 *
 * @extends EventEmitter
 * @requires events
 */
class JsonRpcClientFactory extends EventEmitter {
  /**
   * @inheritdoc
   * @param {Object} options Connection options for the factory class
   * @param {string} [options.host="127.0.0.1"] IP of server to connect to
   * @param {number} [options.port=8100] Port of server to connect to
   * @param {number} [options.version=2] JSON-RPC version to use (1|2)
   * @param {string} [options.delimiter="\n"] Delimiter to use for requests
   * @param {number} [options.timeout=30] Timeout for request response
   * @param {number} [options.connectionTimeout=5000] Timeout for connection to server
   * @param {number} [options.retries=2] Number of connection retry attempts
   * @property {class} pcolInstance The [JsonRpcClientProtocol]{@link JsonRpcClientProtocol} instance
   * @property {object} timeouts Key value pairs of request IDs to <code>setTimeout</code> instance
   * @property {number} requestTimeout Same as <code>options.timeout</code>
   * @property {number} remainingRetries Same as <code>options.retries</code>
   * @property {number} connectionTimeout Same as <code>options.connectionTimeout</code>
   * @property {object} server Object of host and port <code>{host: options.host, port: options.port}</code>
   */
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

    this.options = {
      ...defaults,
      ...(options || {})
    };
    this.pcolInstance = undefined;
    this.timeouts = {};
    this.requestTimeout = this.options.timeout * 1000;
    this.remainingRetries = this.options.retries;
    this.connectionTimeout = this.options.connectionTimeout;

    this.server = { host: this.options.host, port: this.options.port };
  }

  /**
   * Calls <code>connect()</code> on protocol instance
   *
   * @abstract
   */
  connect() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Calls <code>end()</code> on protocol instance
   *
   * @abstract
   */
  end() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Subscribe the function to the given event name
   *
   * @param {string} method Method to subscribe to
   * @param {function} cb  Name of callback function to invoke on event
   * @abstract
   */
  subscribe() {
    throw new Error("function must be overwritten in subsclass");
  }

  /**
   * Unsubscribe the function from the given event name
   *
   * @param {string} method Method to unsubscribe from
   * @param {function} cb Name of function to remove
   * @abstract
   */
  unsubscribe() {
    throw new Error("function must be overwritten in subsclass");
  }

  /**
   * Unsubscribe all functions from given event name
   *
   * @param {string} method Method to unsubscribe all listeners from
   * @abstract
   */
  unsubscribeAll() {
    throw new Error("function must be overwritten in subsclass");
  }

  /**
   * Calls <code>request()</code> method on protocol instance
   */
  request() {
    return this.pcolInstance.request();
  }

  /**
   * Calls <code>batch()</code> method on protocol instance
   *
   * @param {JSON[]} requests Valid JSON-RPC batch request array
   */
  batch(requests) {
    return this.pcolInstance.batch(requests);
  }

  /**
   * Emits a <code>serverDisconnected</code> event, passing the callback function
   *
   * @param {function} cb
   */
  serverDisconnected(cb) {
    this.on("serverDisconnected", cb);
  }

  /**
   * Clears pending timeouts kept in <code>timeouts</code> for the provided request IDs.
   *
   * @param {string[]|number[]} ids Array of request IDs
   */
  cleanUp(ids) {
    clearTimeout(this.timeouts[ids]);
    delete this.timeouts[ids];
  }
}
module.exports = JsonRpcClientFactory;

/**
 * TCP client constructor
 * @type TcpClientFactory
 * @static
 */
JsonRpcClientFactory.tcp = require("./tcp");

/**
 * HTTP client constructor
 * @type HttpClientFactory
 * @static
 */
JsonRpcClientFactory.http = require("./http");

/**
 * WebSocket client constructor
 * @type WsClientFactory
 * @static
 */
JsonRpcClientFactory.ws = require("./ws");
