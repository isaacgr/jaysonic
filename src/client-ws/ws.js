/* eslint no-console: 0 */
const WsBrowserClientProtocol = require("../client/protocol/ws-browser");

/**
 * Creates an instance of WsBrowserClientFactory.
 *
 * For websocket client use in the browser.
 *
 * @extends EventTarget
 */
class WsBrowserClientFactory extends EventTarget {
  /**
   * @inheritdoc
   * @param {Object} options Connection options for the factory class
   * @param {string} [options.url="ws://127.0.0.1:8100"] IP of server to connect to
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
   * @property {string} url Same as `options.url`
   */
  constructor(options) {
    super();
    if (!(this instanceof WsBrowserClientFactory)) {
      return new WsBrowserClientFactory(options);
    }

    const defaults = {
      url: "ws://127.0.0.1:8100",
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
    this.url = this.options.url;
    this.eventListenerList = {};

    this.requestTimeout = this.options.timeout * 1000;
    this.remainingRetries = this.options.retries;
    this.connectionTimeout = this.options.connectionTimeout;
  }

  /**
   * Calls `connect()` on protocol instance.
   * @returns {function} pcolInstance.connect()
   */
  connect() {
    if (this.pcolInstance) {
      // not having this caused MaxEventListeners error
      return Promise.reject(Error("client already connected"));
    }
    this.pcolInstance = new WsBrowserClientProtocol(
      this,
      this.options.version,
      this.options.delimiter
    );
    return this.pcolInstance.connect();
  }

  /**
   * Calls `end()` on protocol instance
   *
   */
  end(cb) {
    this.pcolInstance.end(cb);
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
   * Clears pending timeouts kept in `timeouts` for the provided request IDs.
   *
   * @param {string[]|number[]} ids Array of request IDs
   */
  cleanUp(ids) {
    // clear pending timeouts for these request ids
    clearTimeout(this.timeouts[ids]);
    delete this.timeouts[ids];
  }

  /**
   * Subscribe the function to the given event name
   *
   * @param {string} method Method to subscribe to
   * @param {function} cb  Name of callback function to invoke on event
   */
  subscribe(method, cb) {
    if (!this.eventListenerList) this.eventListenerList = {};
    if (!this.eventListenerList[method]) this.eventListenerList[method] = [];

    // add listener to  event tracking list
    this.eventListenerList[method].push({
      type: method,
      listener: cb
    });
    this.addEventListener(method, cb);
  }

  /**
   * Unsubscribe the function from the given event name
   *
   * @param {string} method Method to unsubscribe from
   * @param {function} cb Name of function to remove
   */
  unsubscribe(method, cb) {
    // remove listener
    this.removeEventListener(method, cb);

    // Find the event in the list and remove it
    this._removeListener(method, cb);

    // if no more events of the removed event method are left,remove the group
    if (this.eventListenerList[method].length === 0) {
      delete this.eventListenerList[method];
    }
  }

  /**
   * Unsubscribe all functions from given event name
   *
   * @param {string} method Method to unsubscribe all listeners from
   */
  unsubscribeAll(method) {
    if (!this.eventListenerList) {
      this.eventListenerList = {};
    }
    if (!this.eventListenerList[method]) {
      this.eventListenerList[method] = [];
    }
    // remove listener
    for (let j = 0; j < this.eventListenerList[method].length; j += 1) {
      const cb = this.eventListenerList[method][j].listener;
      // remove listener
      this.removeEventListener(method, cb);

      // Find the event in the list and remove it
      this._removeListener(method, cb);
    }
    delete this.eventListenerList[method];
  }

  /**
   * Remmove the callback function from the given event listener
   *
   * @param {method} method Method name to remove listener for
   * @param {function} cb Function name to remove listener
   * @private
   */
  _removeListener(method, cb) {
    if (!this.eventListenerList) {
      this.eventListenerList = {};
    }
    if (!this.eventListenerList[method]) {
      this.eventListenerList[method] = [];
    }
    for (let i = 0; i < this.eventListenerList[method].length; i += 1) {
      if (this.eventListenerList[method][i].listener === cb) {
        this.eventListenerList[method].splice(i, 1);
        break;
      }
    }
  }

  /**
   * Get the list of event listeners attached to the given event name.
   *
   * @param {string} name The name of the event to retrieve listeners for
   * @returns {function|function[]}
   */
  getEventListeners(name) {
    if (!this.eventListenerList) {
      this.eventListenerList = {};
    }
    // return requested listeners by name or all them
    if (name === undefined) {
      return this.eventListenerList;
    }
    return this.eventListenerList[name];
  }
}

module.exports = WsBrowserClientFactory;
