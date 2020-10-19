const JsonRpcClientFactory = require(".");
const TcpClientProtocol = require("./protocol/tcp");

/**
 * Creates instance of TcpClientFactory
 *
 * @extends JsonRpcClientFactory
 */
class TcpClientFactory extends JsonRpcClientFactory {
  /** @inheritdoc */
  buildProtocol() {
    this.pcolInstance = new TcpClientProtocol(
      this,
      this.options.version,
      this.options.delimiter
    );
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

module.exports = TcpClientFactory;
