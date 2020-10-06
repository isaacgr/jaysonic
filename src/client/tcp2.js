const JsonRpcClientFactory = require("./index2");
const TcpClientProtocol = require("./protocol/tcp");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */
class TCPClient extends JsonRpcClientFactory {
  connect() {
    if (this.pcolInstance) {
      // not having this caused MaxEventListeners error
      return Promise.reject(Error("client already connected"));
    }
    this.pcolInstance = new TcpClientProtocol(
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

module.exports = TCPClient;
