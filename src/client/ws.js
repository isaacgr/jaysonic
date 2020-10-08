const JsonRpcClientFactory = require(".");
const WsClientProtocol = require("./protocol/ws");

/**
 * Constructor for Jsonic TCP client
 * @class WSClient
 * @constructor
 * @extends JsonRpcClientFactory
 * @param {Object} [options] optional settings for client
 * @return WSClient
 */
class WSClient extends JsonRpcClientFactory {
  constructor(options) {
    super(options);

    if (!(this instanceof WSClient)) {
      return new WSClient(options);
    }

    const defaults = {
      url: "ws://127.0.0.1:8100"
    };

    this.options = {
      ...defaults,
      ...(this.options || {})
    };

    this.url = this.options.url;
  }

  connect() {
    if (this.pcolInstance) {
      // not having this caused MaxEventListeners error
      return Promise.reject(Error("client already connected"));
    }
    this.pcolInstance = new WsClientProtocol(
      this,
      this.options.version,
      this.options.delimiter
    );
    return this.pcolInstance.connect();
  }

  end(cb) {
    this.pcolInstance.end(cb);
  }

  /**
   * @params {String} [method] method to subscribe to
   * @params {Function} [cb] callback function to invoke on notify
   */
  subscribe(method, cb) {
    this.on(method, cb);
  }

  /**
   * @params {String} [method] method to unsubscribe from
   * @params {Function} [cb] name of function to remove
   */
  unsubscribe(method, cb) {
    this.removeListener(method, cb);
  }

  /**
   * @params {String} [method] method to unsubscribe all listeners from
   */
  unsubscribeAll(method) {
    this.removeAllListeners([method]);
  }
}

module.exports = WSClient;
