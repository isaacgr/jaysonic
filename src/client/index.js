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
   * @property {object} timeouts Key value pairs of request IDs to `setTimeout` instance
   * @property {number} requestTimeout Same as `options.timeout`
   * @property {number} remainingRetries Same as `options.retries`
   * @property {number} connectionTimeout Same as `options.connectionTimeout`
   * @property {object} server Object of host and port `{host: options.host, port: options.port}`
   */
  constructor(options) {
    super();
    if (!(this instanceof JsonRpcClientFactory)) {
      return new JsonRpcClientFactory(options);
    }

    const defaults = {
      host: "127.0.0.1",
      port: "8100",
      version: 2,
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
   * Calls `connect()` on protocol instance
   *
   * @abstract
   */
  connect() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Calls `end()` on protocol instance
   *
   * @abstract
   */
  end() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Subscribe the function to the given event name
   *
   * @param {string} method Method name to subscribe to
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
   * Calls `message()` on the protocol instance
   *
   * @param {string} method Name of the method to use in the request
   * @param {Array|JSON} params Params to send
   * @param {boolean=} id If true it will use instances `message_id` for the request id, if false will generate a notification request
   * @example
   * client.message("hello", ["world"]) // returns {"jsonrpc": "2.0", "method": "hello", "params": ["world"], "id": 1}
   * client.message("hello", ["world"], false) // returns {"jsonrpc": "2.0", "method": "hello", "params": ["world"]}
   */
  message(method, params, id) {
    return this.pcolInstance.message(method, params, id);
  }

  /**
   * Calls `send()` method on protocol instance
   *
   * Promise will resolve when a response has been received for the request.
   *
   * Promise will reject if the server responds with an error object, or if
   * the response is not received within the set `requestTimeout`
   *
   * @param {string} method Name of the method to use in the request
   * @param {Array|JSON} params Params to send
   * @returns Promise
   * @example
   * client.send("hello", {"foo": "bar"})
   */
  send(method, params) {
    return this.pcolInstance.send(method, params);
  }

  /**
   * Calls `notify()` method on protocol instance
   *
   * Promise will resolve if the request was sucessfully sent, and reject if
   * there was an error sending the request.
   *
   * @param {string} method Name of the method to use in the notification
   * @param {Array|JSON} params Params to send
   * @return Promise
   * @example
   * client.notify("hello", ["world"])
   */
  notify(method, params) {
    return this.pcolInstance.notify(method, params);
  }

  /**
   * Calls `request()` method on protocol instance
   *
   * Plans to deprecate this in future versions.
   */
  request() {
    return this.pcolInstance.request();
  }

  /**
   * Calls `batch()` method on protocol instance
   *
   * @param {JSON[]} requests Valid JSON-RPC batch request array
   */
  batch(requests) {
    return this.pcolInstance.batch(requests);
  }

  /**
   * Emits a `serverDisconnected` event, passing the callback function
   *
   * @param {function} cb
   */
  serverDisconnected(cb) {
    this.on("serverDisconnected", cb);
  }

  /**
   * Clears pending timeouts kept in `timeouts` property for the provided request IDs.
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
