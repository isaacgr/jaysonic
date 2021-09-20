const MessageBuffer = require("../../util/buffer");
const { formatResponse, formatError } = require("../../util/format");
const { ERR_CODES, ERR_MSGS } = require("../../util/constants");

/**
 * Creates an instance of JsonRpcServerProtocol. This is the
 * base protocol from which all others inherit.
 *
 */
class JsonRpcServerProtocol {
  /**
   * @param {class} factory Instance of [JsonRpcServerFactory]{@link JsonRpcServerFactory}
   * @param {class} client Instance of `net.Socket`
   * @param {(1|2)} version JSON-RPC version to use
   * @param {string} delimiter Delimiter to use for `messageBuffer`
   * @property {class} messageBuffer Instance of [MessageBuffer]{@link MessageBuffer}
   * @property {string} event="data" The event name to listen for incoming data
   */
  constructor(factory, client, version, delimiter) {
    this.client = client;
    this.factory = factory;
    this.delimiter = delimiter;
    this.version = version;
    this.messageBuffer = new MessageBuffer(delimiter);
    this.event = "data";
  }

  /**
   * Registers the `event` data listener when client connects.
   *
   * Pushes received data into `messageBuffer` and calls
   * [_waitForData]{@link JsonRpcServerProtocol#_waitForData}.
   *
   */
  clientConnected() {
    this.client.on(this.event, (data) => {
      this.messageBuffer.push(data);
      this._waitForData();
    });
  }

  /**
   * Accumulate data while [MessageBuffer.isFinished]{@link MessageBuffer#isFinished} is returning false.
   *
   * If the buffer returns a message it will be passed to [validateRequest]{@link JsonRpcServerProtocol#validateRequest}.
   * If [validateRequest]{@link JsonRpcServerProtocol#validateRequest} returns a parsed result, then the result
   * is passed to [_maybeHandleRequest]{@link JsonRpcServerProtocol#_maybeHandleRequest}.
   * If [_maybeHandleRequest]{@link JsonRpcServerProtocol#_maybeHandleRequest} returns true, then
   * [gotRequest]{@link JsonRpcServerProtocol#gotRequest} is called.<br/><br/>
   *
   * If any of the above throws an error, [gotError]{@link JsonRpcServerProtocol#gotError} is called.
   *
   * @private
   *
   */
  _waitForData() {
    while (!this.messageBuffer.isFinished()) {
      const chunk = this.messageBuffer.handleData();
      this._validateData(chunk);
    }
  }

  /**
   * Validates data returned from `messageBuffer`.
   *
   * Will call [gotError]{@link JsonRpcClientProtocol#gotError} if error thrown
   * during validation.
   *
   * @param {string} chunk Data to validate
   * @private
   *
   */
  _validateData(chunk) {
    try {
      const result = this.validateRequest(chunk);
      const isMessage = this._maybeHandleRequest(result);
      if (isMessage) {
        this.gotRequest(result);
      }
    } catch (e) {
      this.gotError(e);
    }
  }

  /**
   * Validate the request message
   *
   * @param {string} chunk
   * @returns {JSON}
   * @throws Will throw an error with a JSON-RPC error object if chunk cannot be parsed
   */
  validateRequest(chunk) {
    try {
      return JSON.parse(chunk);
    } catch (e) {
      throw new Error(
        formatError({
          jsonrpc: this.version,
          id: null,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError,
          delimiter: this.delimiter
        })
      );
    }
  }

  /**
   * Determines the type of request being made (batch, notification, request) and
   * calls the corresponding function.
   *
   * @param {JSON} result Valid JSON-RPC request object
   * @private
   */
  _maybeHandleRequest(result) {
    if (Array.isArray(result)) {
      if (result.length === 0) {
        return this.writeToClient(
          formatError({
            code: ERR_CODES.invalidRequest,
            message: ERR_MSGS.invalidRequest,
            delimiter: this.delimiter,
            jsonrpc: this.version,
            id: null
          })
        );
      }
      // possible batch request
      this.gotBatchRequest(result).then((res) => {
        if (res.length !== 0) {
          // if all the messages in the batch were notifications,
          // then we wouldnt want to return anything
          this.writeToClient(JSON.stringify(res) + this.delimiter);
        }
      });
    } else if (result === Object(result) && !("id" in result)) {
      // no id, so assume notification
      this.gotNotification(result);
      return false;
    } else {
      this.validateMessage(result);
      return true;
    }
  }

  /**
   * Validates if there are any issues with the incoming request<br/>
   *
   *
   * @param {JSON} message Valid JSON-RPC request object
   * @throws Will throw an error for any of the below reasons
   *
   * Reason|Type
   * ---|---
   * message is not an object| Invalid Request
   * the server does not have the required method| Method Not Found
   * the params are not an array or object| Invalid Params
   * the "jsonrpc" property was passed for a v1 server| Invalid Request
   */
  validateMessage(message) {
    if (!(message === Object(message))) {
      this._raiseError(
        ERR_MSGS.invalidRequest,
        ERR_CODES.invalidRequest,
        null,
        this.version
      );
    } else if (!(typeof message.method === "string")) {
      this._raiseError(
        ERR_MSGS.invalidRequest,
        ERR_CODES.invalidRequest,
        message.id,
        message.jsonrpc
      );
    } else if (!(message.method in this.factory.methods)) {
      this._raiseError(
        ERR_MSGS.methodNotFound,
        ERR_CODES.methodNotFound,
        message.id,
        message.jsonrpc
      );
    } else if (
      message.params
      && !Array.isArray(message.params)
      && !(message.params === Object(message.params))
    ) {
      this._raiseError(
        ERR_MSGS.invalidParams,
        ERR_CODES.invalidParams,
        message.id,
        message.jsonrpc
      );
    } else if (message.jsonrpc && this.version !== 2) {
      this._raiseError(
        ERR_MSGS.invalidRequest,
        ERR_CODES.invalidRequest,
        message.id,
        this.version
      );
    }
  }

  /**
   * Send message to the client
   *
   * @param {string} message Stringified JSON-RPC message object
   */
  writeToClient(message) {
    this.client.write(message);
  }

  /**
   * Calls `emit` on factory with the event name being `message.method` and
   * the date being `message`.
   *
   * @param {string} message JSON-RPC message object
   */
  gotNotification(message) {
    this.factory.emit(message.method, message);
  }

  /**
   * Attempts to get the result for the request object. Will
   * send result to client if successful and will send an error
   * otherwise.
   *
   * @param {JSON} message JSON-RPC message object
   * @returns {Promise}
   */
  gotRequest(message) {
    return this.getResult(message)
      .then((result) => {
        this.writeToClient(result);
      })
      .catch((error) => {
        this.gotError(Error(error));
      });
  }

  /**
   * Attempts to get the result for all requests in the batch.
   * Will send result to client if successful and error otherwise.
   *
   * @param {JSON[]} requests Valid JSON-RPC batch request
   * @returns {Promise[]}
   */
  gotBatchRequest(requests) {
    const batchResponses = requests
      .map((request) => {
        try {
          const isMessage = this._maybeHandleRequest(request);
          if (isMessage) {
            // if its a notification we dont want to return anything
            return this.getResult(request)
              .then(result => JSON.parse(result))
              .catch(error => JSON.parse(error));
          }
          return null;
        } catch (e) {
          // basically reject the whole batch if any one thing fails
          return JSON.parse(e.message);
        }
      })
      .filter(el => el != null);
    return Promise.all(batchResponses);
  }

  /**
   * Get the result for the request. Calls the function associated
   * with the method and returns the result.
   *
   * @param {JSON} message Valid JSON-RPC message object
   * @returns {Promise}
   */
  getResult(message) {
    // function needs to be async since the method can be a promise
    return new Promise((resolve, reject) => {
      const { params } = message;
      const response = {
        jsonrpc: message.jsonrpc,
        id: message.id,
        delimiter: this.delimiter
      };
      const error = {
        jsonrpc: message.jsonrpc,
        id: message.id,
        delimiter: this.delimiter
      };
      try {
        const methodResult = params
          ? this.factory.methods[message.method](params)
          : this.factory.methods[message.method]();
        if (
          methodResult instanceof Promise
          || typeof methodResult.then === "function"
        ) {
          Promise.all([methodResult])
            .then((results) => {
              response.result = results;
              resolve(formatResponse(response));
            })
            .catch((resError) => {
              error.code = ERR_CODES.internal;
              error.message = `${JSON.stringify(resError.message || resError)}`;
              reject(formatError(error));
            });
        } else {
          response.result = methodResult;
          resolve(formatResponse(response));
        }
      } catch (e) {
        if (e instanceof TypeError) {
          error.code = ERR_CODES.invalidParams;
          error.message = ERR_MSGS.invalidParams;
          // error.data = e.message;
        } else {
          error.code = ERR_CODES.unknown;
          error.message = ERR_MSGS.unknown;
          // error.data = e.message;
        }
        reject(formatError(error));
      }
    });
  }

  /**
   *
   * @param {string} message Error message
   * @param {number} code Error code
   * @param {string|number} id Error message ID
   * @throws Throws a JSON-RPC error object
   * @private
   */
  _raiseError(message, code, id, version) {
    const error = formatError({
      jsonrpc: version,
      delimiter: this.delimiter,
      id,
      code,
      message
    });
    throw new Error(error);
  }

  /**
   * Writes error to the client. Will send a JSON-RPC error object if the
   * passed error cannot be parsed.
   *
   * @param {Error} error `Error` object instance where the message should be a JSON-RPC message object
   */
  gotError(error) {
    let err;
    try {
      err = JSON.stringify(JSON.parse(error.message)) + this.delimiter;
    } catch (e) {
      err = formatError({
        jsonrpc: this.version,
        delimiter: this.delimiter,
        id: null,
        code: ERR_CODES.unknown,
        message: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
    }
    this.writeToClient(err);
  }
}

module.exports = JsonRpcServerProtocol;
