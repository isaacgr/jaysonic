const JsonRpcClientFactory = require(".");
const WsClientProtocol = require("./protocol/ws");

/**
 * Creates instance of WsClientFactory
 *
 * @extends JsonRpcClientFactory
 */
class WsClientFactory extends JsonRpcClientFactory {
  /**
   * Additional parameters ontop of those inherited from [JsonRpcClientFactory]{@link JsonRpcClientFactory}
   * @param {object} options Connection options for factory class
   * @param {string} [options.url="ws://127.0.0.1:8100"] Websocket URL to connect to
   * @property {string} url Same as <code>options.url</code>
   */
  constructor(options) {
    super(options);

    if (!(this instanceof WsClientFactory)) {
      return new WsClientFactory(options);
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

  /** @inheritdoc */
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

  /** @inheritdoc */
  end(cb) {
    this.pcolInstance.end(cb);
  }

  /** @inheritdoc */
  subscribe(method, cb) {
    this.on(method, cb);
  }

  /** @inheritdoc */
  unsubscribe(method, cb) {
    this.removeListener(method, cb);
  }

  /** @inheritdoc */
  unsubscribeAll(method) {
    this.removeAllListeners([method]);
  }
}

module.exports = WsClientFactory;
