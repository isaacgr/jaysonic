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
   * @property {object} timeouts Key value pairs of request IDs to <code>setTimeout</code> instance
   * @property {number} requestTimeout Same as <code>options.timeout</code>
   * @property {number} remainingRetries Same as <code>options.retries</code>
   * @property {number} connectionTimeout Same as <code>options.connectionTimeout</code>
   * @property {string} url Same as <code>options.url</code>
   */
  constructor(options) {
    super();
    if (!(this instanceof WsBrowserClientFactory)) {
      return new WsBrowserClientFactory(options);
    }

    const defaults = {
      url: "ws://127.0.0.1:8100",
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
    this.url = this.options.url;
    this.eventListenerList = {};

    this.requestTimeout = this.options.timeout * 1000;
    this.remainingRetries = this.options.retries;
    this.connectionTimeout = this.options.connectionTimeout;
  }

  /**
   * Calls <code>connect()</code> on protocol instance
   *
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
   * Calls <code>end()</code> on protocol instance
   *
   */
  end(cb) {
    this.pcolInstance.end(cb);
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
   * Clears pending timeouts kept in <code>timeouts</code> for the provided request IDs.
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
   * @abstract
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
   * @abstract
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
   * @abstract
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

  getEventListeners(type) {
    if (!this.eventListenerList) {
      this.eventListenerList = {};
    }
    // return requested listeners type or all them
    if (type === undefined) {
      return this.eventListenerList;
    }
    return this.eventListenerList[type];
  }
}

module.exports = WsBrowserClientFactory;
