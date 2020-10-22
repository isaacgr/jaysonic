const http = require("http");
const https = require("https");
const JsonRpcClientProtocol = require("./base");

/**
 * Creates an instance of HttpClientProtocol, which has some tweaks from the base class
 * required to work with the `node.http` package
 *
 * @extends JsonRpcClientProtocol
 * @requires http
 * @requires https
 */
class HttpClientProtocol extends JsonRpcClientProtocol {
  /**
   * In addition to the params and properties of [JsonRpcClientProtocol]{@link JsonRpcClientProtocol},
   * the HttpClientProtocol has the following properties
   *
   * @property {object} headers HTTP headers passed to the factory instance
   * @property {string} encoding Encoding type passed to the factory instance
   * @property {('http'|'https')} scheme The scheme to use to connect to the server
   */
  constructor(factory, version, delimiter) {
    super(factory, version, delimiter);

    this.headers = this.factory.headers;
    this.encoding = this.factory.encoding;
    this.scheme = this.factory.scheme;
  }

  /**
   * Send a message to the server. Sets the request headers passed into `headers`
   *
   * Calls [listen]{@link JsonRpcClientProtocol#listen} to start listening for recieved data from server.
   *
   * Ends connection when all data received from the server.
   *
   * Emits a `serverDisconnected` event when connection is closed.
   *
   * Throws an error if there was an `error` event received when sending the request
   *
   * @param {string} request Stringified JSON-RPC message object
   * @param {function=} cb Callback function to be called when message has been sent
   */
  write(request, cb) {
    const options = {
      ...this.factory.options,
      ...this.headers
    };
    this.headers["Content-Length"] = Buffer.byteLength(request, this.encoding);
    const responseCallback = (response) => {
      if (cb) {
        response.on("end", cb);
      }
      this.listener = response;
      this.listen();
    };
    if (this.scheme === "http") {
      this.connector = http.request(options, responseCallback);
    } else if (this.scheme === "https") {
      this.connector = https.request(options, responseCallback);
    } else {
      throw Error("Invalid scheme");
    }
    this.connector.write(request, this.encoding);
    this.connector.end();
    this.connector.on("close", () => {
      this.factory.emit("serverDisconnected");
    });
    this.connector.on("error", (error) => {
      throw error;
    });
  }

  /**
   * Setup `this.listener.on("data")` event to listen for data coming into the client.
   *
   * The HTTP client does not use the messageBuffer since each request should
   * only receive one response at a time.
   *
   * Calls [_waitForData]{@link JsonRpcClientProtocol#_waitForData}
   */
  listen() {
    this.listener.on("data", (data) => {
      this._waitForData(data);
    });
  }

  /**
   * Pass incoming data to [verifyData]{@link JsonRpcClientProtocol#verifyData}
   *
   * @private
   *
   */
  _waitForData(data) {
    try {
      this.verifyData(data);
    } catch (e) {
      this.gotError(e);
    }
  }

  /**
   * Send a notification to the server.
   *
   * Promise will resolve if the request was sucessfully sent, and reject if
   * there was an error sending the request. For the [HttpClientProtocol]{@link HttpClientProtocol}, the resolved promise
   * will return the http response object with a `204` response code per the spec.
   *
   * @param {string} method Name of the method to use in the notification
   * @param {Array|JSON} params Params to send
   * @return Promise
   * @example
   * client.notify("hello", ["world"])
   */
  notify(method, params) {
    return new Promise((resolve, reject) => {
      const request = this.message(method, params, false);
      try {
        this.write(request, () => {
          if (this.listener.statusCode === 204) {
            resolve(this.listener);
          } else {
            reject(new Error("no response receieved for notification"));
          }
        });
      } catch (e) {
        // this.connector is probably undefined
        reject(e);
      }
    });
  }

  /** @inheritdoc */
  getResponse(id) {
    return {
      body: this.responseQueue[id],
      headers: {
        ...this.listener.headers
      }
    };
  }

  /** @inheritdoc */
  getBatchResponse(batch) {
    return {
      body: batch,
      headers: {
        ...this.listener.headers
      }
    };
  }

  /** @inheritdoc */
  rejectPendingCalls(error) {
    const err = {
      body: error,
      headers: {
        ...this.listener.headers
      }
    };
    try {
      this.pendingCalls[err.body.id].reject(err);
      this.factory.cleanUp(err.body.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(err.body)}`
        );
      }
    }
  }
}

module.exports = HttpClientProtocol;
