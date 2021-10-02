const { formatRequest, formatError } = require("../../util/format");
const { ERR_CODES, ERR_MSGS } = require("../../util/constants");
const MessageBuffer = require("../../util/buffer");
const logging = require("../../util/logger");

/**
 * Creates an instance of the base client protocol class.
 * This is the class that all other client protocols inherit from.
 */
class JsonRpcClientProtocol {
  /**
   * JsonRpcClientProtocol contructor
   * @param {class} factory Instance of [JsonRpcClientFactory]{@link JsonRpcClientFactory}
   * @param {(1|2)} version JSON-RPC version to make requests with
   * @param {string} delimiter Delimiter to use for message buffer
   * @property {class} factory Instance of [JsonRpcClientFactory]{@link JsonRpcClientFactory}
   * @property {class} connector The socket instance for the client
   * @property {(1|2)} version JSON-RPC version to use
   * @property {string} delimiter Delimiter to use for message buffer
   * @property {number} message_id Current message ID
   * @property {number} serving_message_id Current message ID. Used for external functions to hook into
   * @property {Object} pendingCalls Key value pairs for pending message IDs to promise resolve/reject objects
   * @property {Object.<string|number, JSON>} responseQueue Key value pairs for outstanding message IDs to response object
   * @property {Object} server Server host and port object {host: "x.x.x.x", port: xxxx}
   * @property {class} messageBuffer Instance of [MessageBuffer]{@link MessageBuffer}
   *
   */
  constructor(factory, version, delimiter) {
    if (!(this instanceof JsonRpcClientProtocol)) {
      return new JsonRpcClientProtocol(factory, version, delimiter);
    }
    this.factory = factory;
    this.connector = undefined;
    this.listener = undefined;
    this.delimiter = delimiter;
    this.version = version;
    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};
    this.responseQueue = {};
    this.server = this.factory.server;
    this._connectionTimeout = undefined;
    this.messageBuffer = new MessageBuffer(this.delimiter);
  }

  /**
   * Set the `connector` attribute for the protocol instance.
   * The connector is essentially the socket or connection instance for the client.
   *
   * @abstract
   *
   */
  setConnector() {
    throw Error("function must be overwritten in subclass");
  }

  /**
   * Make the connection to the server.
   *
   * Calls [setConnector]{@link JsonRpcClientProtocol#setConnector} to establish the client connection.
   *
   * Calls [listen]{@link JsonRpcClientProtocol#listen} if connection was successful, and will resolve the promise.
   *
   * Will retry connection on the `connectionTimeout` interval.
   * Number of connection retries is based on `remainingRetries`.
   *
   * If `null` is set for number of retries, then connections will attempt indefinitely.
   *
   * Will reject the promise if connect or re-connect attempts fail and there are no remaining retries.
   *
   * @returns Promise
   *
   */
  connect() {
    return new Promise((resolve, reject) => this._retryConnection(resolve, reject));
  }

  /**
   *
   * Manage the connection attempts for the client.
   *
   * @param {Promise.resolve} resolve `Promise.resolve` passed from [connect]{@link JsonRpcClientProtocol#connect}
   * @param {Promise.reject} reject `Promise.reject` passed from [connect]{@link JsonRpcClientProtocol#connect}
   *
   * @returns Promise
   *
   * @private
   */
  _retryConnection(resolve, reject) {
    this.setConnector();
    this.connector.connect(this.server);
    this.connector.setEncoding("utf8");
    this.connector.on("connect", () => {
      this.listener = this.connector;
      this.listen();
      resolve(this.server);
    });
    this.connector.on("error", error => this._onConnectionFailed(error, resolve, reject));
    this.connector.on("close", () => {
      this.factory.emit("serverDisconnected");
    });
  }

  /**
   *
   * Handle connection attempt errors. Log failures and
   * retry if required.
   *
   *
   * @param {Error} error `node.net` system error (https://nodejs.org/api/errors.html#errors_common_system_errors)
   * @param {Promise.resolve} resolve `Promise.resolve` passed from [connect]{@link JsonRpcClientProtocol#connect}
   * @param {Promise.reject} reject `Promise.reject` passed from [connect]{@link JsonRpcClientProtocol#connect}
   *
   * @returns Promise
   *
   * @private
   */
  _onConnectionFailed(error, resolve, reject) {
    if (this.factory.remainingRetries > 0) {
      this.factory.remainingRetries -= 1;
      logging
        .getLogger()
        .info(
          `Failed to connect. Address [${this.server.host}:${this.server.port}]. Retrying. ${this.factory.remainingRetries} attempts left.`
        );
    } else if (this.factory.remainingRetries === 0) {
      this.factory.pcolInstance = undefined;
      return reject(error);
    } else {
      logging
        .getLogger()
        .info(
          `Failed to connect. Address [${this.server.host}:${this.server.port}]. Retrying.`
        );
    }
    this._connectionTimeout = setTimeout(() => {
      this._retryConnection(resolve, reject);
    }, this.factory.connectionTimeout);
  }

  /**
   * Ends connection to the server.
   *
   * Sets `JsonRpcClientFactory.pcolInstance` to `undefined`
   *
   * Clears the connection timeout
   *
   * @param {function} cb Called when connection is sucessfully closed
   */
  end(cb) {
    clearTimeout(this._connectionTimeout);
    this.factory.pcolInstance = undefined;
    this.connector.end(cb);
  }

  /**
   * Setup `this.listner.on("data")` event to listen for data coming into the client.
   *
   * Pushes received data into `messageBuffer` and calls
   * [_waitForData]{@link JsonRpcClientProtocol#_waitForData}
   */
  listen() {
    this.listener.on("data", (data) => {
      this.messageBuffer.push(data);
      this._waitForData();
    });
  }

  /**
   * Accumulate data while [MessageBuffer.isFinished]{@link MessageBuffer#isFinished} is returning false.
   *
   * If the buffer returns a message it will be passed to [verifyData]{@link JsonRpcClientProtocol#verifyData}
   *
   * @private
   *
   */
  _waitForData() {
    while (!this.messageBuffer.isFinished()) {
      const message = this.messageBuffer.handleData();
      try {
        this.verifyData(message);
      } catch (e) {
        this.gotError(e);
      }
    }
  }

  /**
   * Verify the incoming data returned from the `messageBuffer`
   *
   * Throw an error if its not a valid JSON-RPC object.
   *
   * Call [gotNotification]{@link JsonRpcClientProtocol#gotNotification} if the message a notification.
   *
   * Call [gotBatch]{@link JsonRpcClientProtocol#gotBatch} if the message is a batch request.
   *
   * @param {string} chunk Data to verify
   */
  verifyData(chunk) {
    try {
      // will throw an error if not valid json
      const message = JSON.parse(chunk);
      if (Array.isArray(message)) {
        this.gotBatch(message);
      } else if (!(message === Object(message))) {
        // error out if it cant be parsed
        throw SyntaxError();
      } else if (!("id" in message)) {
        // no id, so assume notification
        this.gotNotification(message);
      } else if (message.error) {
        // got an error back so reject the message
        const { id } = message;
        const { code } = message.error;
        const errorMessage = message.error.message;
        this._raiseError(errorMessage, code, id);
      } else if ("result" in message) {
        // Got a result, so must be a response
        this.gotResponse(message);
      } else {
        const code = ERR_CODES.unknown;
        const errorMessage = ERR_MSGS.unknown;
        this._raiseError(errorMessage, code, null);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        const code = ERR_CODES.parseError;
        const errorMessage = `Unable to parse message: '${chunk}'`;
        this._raiseError(errorMessage, code, null);
      } else {
        throw e;
      }
    }
  }

  /**
   * Called when the received `message` is a notification.
   * Emits an event using `message.method` as the name.
   * The data passed to the event is the `message`.
   *
   * @param {JSON} message A valid JSON-RPC message object
   */
  gotNotification(message) {
    this.factory.emit(message.method, message);
  }

  /**
   * Called when the received message is a batch.
   *
   * Calls [gotNotification]{@link JsonRpcClientProtocol#gotNotification} for every
   * notification in the batch.
   *
   * Calls [gotBatchResponse]{@link JsonRpcClientProtocol#gotBatchResponse} otherwise.
   *
   * @param {JSON[]} message A valid JSON-RPC batch message
   */
  gotBatch(message) {
    // possible batch request
    message.forEach((res) => {
      if (res && res.method && !res.id) {
        this.gotNotification(res);
      }
    });
    this.gotBatchResponse(message);
  }

  /**
   * Called when the received message is a response object from the server.
   *
   * Gets the response using [getResponse]{@link JsonRpcClientProtocol#getResponse}.
   *
   * Resolves the message and removes it from the `responseQueue`. Cleans up any
   * outstanding timers.
   *
   * @param {JSON} message A valid JSON-RPC message object
   */
  gotResponse(message) {
    this.serving_message_id = message.id;
    this.responseQueue[message.id] = message;
    try {
      const response = this.getResponse(message.id);
      this.pendingCalls[message.id].resolve(response);
      delete this.responseQueue[message.id];
      this.factory.cleanUp(message.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // response id likely not in the queue
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(message)}`
        );
      }
    }
  }

  /**
   * Get the outstanding request object for the given ID.
   *
   * @param {string|number} id ID of outstanding request
   */
  getResponse(id) {
    return this.responseQueue[id];
  }

  /**
   * Send a message to the server
   *
   * @param {string} request Stringified JSON-RPC message object
   * @param {function=} cb Callback function to be called when message has been sent
   */
  write(request, cb) {
    this.connector.write(request, cb);
  }

  /**
   * Generate a stringified JSON-RPC message object.
   *
   * @param {string} method Name of the method to use in the request
   * @param {Array|JSON} params Params to send
   * @param {boolean=} id If true it will use instances `message_id` for the request id, if false will generate a notification request
   * @example
   * client.message("hello", ["world"]) // returns {"jsonrpc": "2.0", "method": "hello", "params": ["world"], "id": 1}
   * client.message("hello", ["world"], false) // returns {"jsonrpc": "2.0", "method": "hello", "params": ["world"]}
   */
  message(method, params, id = true) {
    const request = formatRequest({
      method,
      params,
      id: id ? this.message_id : undefined,
      version: this.version,
      delimiter: this.delimiter
    });
    if (id) {
      this.message_id += 1;
    }
    return request;
  }

  /**
   * Send a notification to the server.
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
    return new Promise((resolve, reject) => {
      const request = this.message(method, params, false);
      try {
        this.write(request, () => {
          resolve(request);
        });
      } catch (e) {
        // this.connector is probably undefined
        reject(e);
      }
    });
  }

  /**
   * Send a request to the server
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
    return new Promise((resolve, reject) => {
      const request = this.message(method, params);
      this.pendingCalls[JSON.parse(request).id] = { resolve, reject };
      try {
        this.write(request);
      } catch (e) {
        // this.connector is probably undefined
        reject(e);
      }
      this._timeoutPendingCalls(JSON.parse(request).id);
    });
  }

  /**
   * Method used to call [message]{@link JsonRpcClientProtocol#message}, [notify]{@link JsonRpcClientProtocol#notify} and [send]{@link JsonRpcClientProtocol#send}
   *
   * @returns Object
   * @example
   * client.request().send("hello", ["world"])
   * client.request().notify("foo")
   * client.request().message("foo", ["bar"])
   */
  request() {
    const self = this;
    return {
      message: this.message.bind(self),
      send: this.send.bind(self),
      notify: this.notify.bind(self)
    };
  }

  /**
   * Used to send a batch request to the server.
   *
   * Recommend using [message]{@link JsonRpcClientProtocol#message} to construct the message objects.
   *
   * Will use the IDs for the requests in the batch in an array as the keys for `pendingCalls`.
   *
   * How a client should associate batch responses to their requests is not in the spec, so this is the solution.
   *
   * @param {Array} requests An array of valid JSON-RPC message objects
   * @returns Promise
   * @example
   * client.batch([client.message("foo", ["bar"]), client.message("hello", [], false)])
   */
  batch(requests) {
    return new Promise((resolve, reject) => {
      const batchIds = [];
      const batchRequests = [];
      for (const request of requests) {
        const json = JSON.parse(request);
        batchRequests.push(json);
        if (json.id) {
          batchIds.push(json.id);
        }
      }
      this.pendingCalls[String(batchIds)] = { resolve, reject };
      const request = JSON.stringify(batchRequests);
      try {
        this.write(request + this.delimiter);
      } catch (e) {
        // this.connector is probably undefined
        reject(e);
      }
      this._timeoutPendingCalls(String(batchIds));
    });
  }

  /**
   * Associate the ids in the batch message to their corresponding `pendingCalls`.
   *
   * Will call [_resolveOrRejectBatch]{@link JsonRpcClientProtocol#_resolveOrRejectBatch} when object is determined.
   *
   * @param {Array} batch Array of valid JSON-RPC message objects
   */
  gotBatchResponse(batch) {
    const batchResponseIds = [];
    batch.forEach((message) => {
      if ("id" in message) {
        batchResponseIds.push(message.id);
      }
    });
    if (batchResponseIds.length === 0) {
      // dont do anything here since its basically an invalid response
      return;
    }
    // find the resolve and reject objects that match the batch request ids
    for (const ids of Object.keys(this.pendingCalls)) {
      const arrays = [JSON.parse(`[${ids}]`), batchResponseIds];
      const difference = arrays.reduce((a, b) => a.filter(c => !b.includes(c)));
      if (difference.length === 0) {
        this.factory.cleanUp(ids);
        this._resolveOrRejectBatch(batch, batchResponseIds);
      }
    }
  }

  /**
   * Returns the batch response.
   *
   * Overwrite if class needs to reformat response in anyway (i.e. in [HttpClientProtocol]{@link HttpClientProtocol})
   *
   * @param {Array} batch  Array of valid JSON-RPC message objects
   */
  getBatchResponse(batch) {
    return batch;
  }

  /**
   * Will reject the request associated with the given ID with a JSON-RPC formated error object.
   *
   * Removes the id from `pendingCalls` and deletes outstanding timeouts.
   *
   * @param {string|number} id ID of the request to timeout
   * @private
   */
  _timeoutPendingCalls(id) {
    this.factory.timeouts[id] = setTimeout(() => {
      this.factory.cleanUp(id);
      try {
        const error = JSON.parse(
          formatError({
            jsonrpc: this.version,
            delimiter: this.delimiter,
            id: typeof id === "string" ? null : id,
            code: ERR_CODES.timeout,
            message: ERR_MSGS.timeout
          })
        );
        this.pendingCalls[id].reject(error);
        delete this.pendingCalls[id];
      } catch (e) {
        if (e instanceof TypeError) {
          console.error(`Message has no outstanding calls. ID [${id}]`);
        }
      }
    }, this.factory.requestTimeout);
  }

  /**
   * Resolve or reject the given batch request based on the given batch IDs.
   *
   * @param {Array} batch Valid JSON-RPC batch request
   * @param {string} batchIds Stringified list of batch IDs associated with the given batch
   * @private
   */
  _resolveOrRejectBatch(batch, batchIds) {
    const batchResponse = this.getBatchResponse(batch);
    try {
      const invalidBatches = [];
      batch.forEach((message) => {
        if (message.error) {
          // reject the whole message if there are any errors
          this.pendingCalls[batchIds].reject(batchResponse);
          invalidBatches.push(batchIds);
        }
      });
      if (invalidBatches.length !== 0) {
        invalidBatches.forEach((id) => {
          delete this.pendingCalls[id];
        });
      } else {
        this.pendingCalls[batchIds].resolve(batchResponse);
        delete this.pendingCalls[batchIds];
      }
    } catch (e) {
      if (e instanceof TypeError) {
        // no outstanding calls
        console.log(
          `Batch response has no outstanding calls. Response IDs [${batchIds}]`
        );
      }
    }
  }

  /**
   * Throws an Error whos message is a JSON-RPC error object
   *
   * @param {string} message Error message
   * @param {number} code Error code
   * @param {string|number=} id ID for error message object
   * @throws Error
   * @private
   */
  _raiseError(message, code, id) {
    const error = formatError({
      jsonrpc: this.version,
      delimiter: this.delimiter,
      id,
      code,
      message
    });
    throw new Error(error);
  }

  /**
   * Calls [rejectPendingCalls]{@link JsonRpcClientProtocol#rejectPendingCalls} with error object.
   *
   * If the object cannot be parsed, then an unkown error code is sent with a `null` id.
   *
   * @param {string} error Stringified JSON-RPC error object
   */
  gotError(error) {
    let err;
    try {
      err = JSON.parse(error.message);
    } catch (e) {
      err = JSON.parse(
        formatError({
          jsonrpc: this.version,
          delimiter: this.delimiter,
          id: null,
          code: ERR_CODES.unknown,
          message: JSON.stringify(error, Object.getOwnPropertyNames(error))
        })
      );
    }
    this.rejectPendingCalls(err);
  }

  /**
   * Reject the pending call for the given ID is in the error object.
   *
   * If the error object has a null id, then log the message to the console.
   *
   * @param {string} error Stringified JSON-RPC error object
   *
   */
  rejectPendingCalls(error) {
    try {
      this.pendingCalls[error.id].reject(error);
      this.factory.cleanUp(error.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // error object id probably not a pending response
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(error)}`
        );
      }
    }
  }
}

module.exports = JsonRpcClientProtocol;
