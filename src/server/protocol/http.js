const JsonRpcServerProtocol = require("./base");
const { errorToStatus } = require("../../util/constants");

/**
 * Creates instance of HttpServerProtocol
 * @extends JsonRpcServerProtocol
 *
 */
class HttpServerProtocol extends JsonRpcServerProtocol {
  /**
   * As well as all the params and properties in [JsonRpcServerProtocol]{@link JsonRpcServerProtocol}
   * the following properties are available.
   *
   * @property {class} response HTTP response object
   *
   */
  constructor(factory, client, response, version, delimiter) {
    super(factory, client, version, delimiter);
    this.response = response;
  }

  /**
   * Send message to the client. If a notification is passed, then
   * a 204 response code is sent.
   *
   * @param {string} message Stringified JSON-RPC message object
   * @param {boolean} notification Indicates if message is a notification
   */
  writeToClient(message, notification) {
    if (notification) {
      this._setResponseHeader({
        response: this.response,
        notification: true
      });
      this.response.end();
      return;
    }
    const json = JSON.parse(message);
    const header = { response: this.response };
    if ("error" in json && json.error !== null) {
      header.errorCode = json.error.code;
    }
    this._setResponseHeader(header);
    this.response.write(message, () => {
      this.response.end();
    });
  }

  /**
   * Calls `emit` on factory with the event name being `message.method` and
   * the date being `message`. Responds to client.
   *
   * @param {string} message Stringified JSON-RPC message object
   */
  gotNotification(message) {
    super.gotNotification(message.method, message);
    this.writeToClient(message, true);
  }

  /** @inheritdoc */
  clientConnected() {
    this.client.on(this.event, (data) => {
      this.client.on("end", () => {
        this._validateData(data);
      });
    });
  }

  /**
   * Set response header and response code
   *
   * @param {object} options
   * @param {class} options.response Http response instance
   * @param {boolean} options.notification Inidicate if setting header for notification
   * @param {number} options.errorCode The JSON-RPC error code to lookup a corresponding status code for
   * @private
   */
  _setResponseHeader({ response, errorCode, notification }) {
    let statusCode = 200;
    if (notification) {
      statusCode = 204;
    }
    const header = {
      "Content-Type": "application/json"
    };
    if (errorCode) {
      statusCode = errorToStatus[String(errorCode)];
    }
    response.writeHead(statusCode, header);
  }
}

module.exports = HttpServerProtocol;
