/* eslint no-console: 0 */
const WsBrowserClientProtocol = require("../client/protocol/ws-browser");

class WSClient extends EventTarget {
  constructor(options) {
    super();
    if (!(this instanceof WSClient)) {
      return new WSClient(options);
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

  end(cb) {
    this.pcolInstance.end(cb);
  }

  request() {
    return this.pcolInstance.request();
  }

  batch(requests) {
    return this.pcolInstance.batch(requests);
  }

  cleanUp(ids) {
    // clear pending timeouts for these request ids
    clearTimeout(this.timeouts[ids]);
    delete this.timeouts[ids];
  }

  /**
   * @params {String} [method] method to subscribe to
   * @params {Function} [cb] callback function to invoke on notify
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
   * @params {String} [method] method to unsubscribe from
   * @params {Function} [cb] name of function to remove
   */
  unsubscribe(method, cb) {
    // remove listener
    this.removeEventListener(method, cb);

    if (!this.eventListenerList) this.eventListenerList = {};
    if (!this.eventListenerList[method]) this.eventListenerList[method] = [];

    // Find the event in the list and remove it
    for (let i = 0; i < this.eventListenerList[method].length; i += 1) {
      if (this.eventListenerList[method][i].listener === cb) {
        this.eventListenerList[method].splice(i, 1);
        break;
      }
    }
    // if no more events of the removed event method are left,remove the group
    if (this.eventListenerList[method].length === 0) delete this.eventListenerList[method];
  }

  unsubscribeAll(method) {
    if (!this.eventListenerList) this.eventListenerList = {};
    if (!this.eventListenerList[method]) this.eventListenerList[method] = [];
    // remove listener
    for (let j = 0; j < this.eventListenerList[method].length; j += 1) {
      const cb = this.eventListenerList[method][j].listener;
      // remove listener
      this.removeEventListener(method, cb);

      if (!this.eventListenerList) this.eventListenerList = {};
      if (!this.eventListenerList[method]) this.eventListenerList[method] = [];

      // Find the event in the list and remove it
      for (let i = 0; i < this.eventListenerList[method].length; i += 1) {
        if (this.eventListenerList[method][i].listener === cb) {
          this.eventListenerList[method].splice(i, 1);
          break;
        }
      }
    }
    delete this.eventListenerList[method];
  }

  getEventListeners(type) {
    if (!this.eventListenerList) this.eventListenerList = {};
    // return requested listeners type or all them
    if (type === undefined) return this.eventListenerList;
    return this.eventListenerList[type];
  }
}

module.exports = WSClient;
