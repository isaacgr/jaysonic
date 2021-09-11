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
   * @property {object} headers={"Content-Type": "application/json"} HTTP response headers
   */
  constructor(factory, client, response, version, delimiter) {
    super(factory, client, version, delimiter);
    this.response = response;
    this.headers = {
      "Content-Type": "application/json"
    };
    this.status = null;
  }

  /**
   * Send message to the client. If a notification is passed, then
   * a 204 response code is sent.
   *
   * @param {string} message Stringified JSON-RPC message object
   */
  writeToClient(message) {
    const json = JSON.parse(message);
    if (!this.status) {
      // set the status code if it has not been overwritten
      if (json.error) {
        this.setResponseStatus({
          errorCode: json.error.code
        });
      } else {
        this.status = 200;
      }
    }
    this.response.writeHead(this.status, this.headers);
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
    this.setResponseStatus({
      notification: true
    });
    this.response.writeHead(this.status, this.headers);
    this.response.end();
  }

  /**
   * @extends HttpServerProtocol.clientConnected
   */
  clientConnected() {
    this.client.on(this.event, (data) => {
      this.client.on("end", () => {
        this._validateData(data);
      });
    });
  }

  /**
   * Set response status code
   *
   * @param {object} options
   * @param {number} options.errorCode The JSON-RPC error code to lookup a corresponding status code for
   * @param {number} options.status The HTTP status code (will override the errorCode)
   * @param {boolean} options.notification Inidicate if setting header for notification (will override other options with 204 status)

   */
  setResponseStatus({ errorCode, status, notification }) {
    this.status = 200;
    if (errorCode) {
      this.status = errorToStatus[String(errorCode)];
    }
    if (status) {
      this.status = status;
    }
    if (notification) {
      this.status = 204; // notification responses must be 204 per spec, so no point in allowing an override
    }
  }
}

module.exports = HttpServerProtocol;
