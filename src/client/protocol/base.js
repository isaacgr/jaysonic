const net = require("net");
const { formatRequest, formatError } = require("../../functions");
const { ERR_CODES, ERR_MSGS } = require("../../constants");
const { MessageBuffer } = require("../../buffer");

class JsonRpcClientProtocol {
  constructor(factory, version, delimiter) {
    if (!(this instanceof JsonRpcClientProtocol)) {
      return new JsonRpcClientProtocol(factory, version, delimiter);
    }
    this.factory = factory;
    this.connector = undefined;
    this.delimiter = delimiter;
    this.version = version;
    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};
    this.pendingBatches = {};
    this.responseQueue = {};
    this.messageBuffer = new MessageBuffer(this.delimiter);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connector = new net.Socket();
      this.connector.connect(this.factory.server);
      this.connector.setEncoding("utf8");
      this.connector.on("connect", () => {
        this.listen();
        resolve(this.factory.server);
      });
      this.connector.on("error", (error) => {
        if (error.code === "ECONNREFUSED" && this.factory.remainingRetries) {
          this.factory.remainingRetries -= 1;
          console.error(
            `Unable to connect. Retrying. ${this.factory.remainingRetries} attempts left.`
          );
          setTimeout(() => {
            this.connect(this.factory.server);
          }, this.factory.options.connectionTimeout);
        } else {
          this.factory.pcolInstance = undefined;
          reject(error);
        }
      });
    });
  }

  end(cb) {
    this.factory.pcolInstance = undefined;
    this.connector.end(cb);
  }

  listen() {
    this.connector.on("data", (data) => {
      this.messageBuffer.push(data);
      this._waitForData();
    });
  }

  _waitForData() {
    while (!this.messageBuffer.isFinished()) {
      const message = this.messageBuffer.handleData();
      try {
        this.verifyData(message);
      } catch (e) {
        this.handleError(e);
      }
    }
  }

  verifyData(chunk) {
    try {
      // will throw an error if not valid json
      const message = JSON.parse(chunk);
      if (Array.isArray(message)) {
        this.handleBatch(message);
      } else if (!(message === Object(message))) {
        // error out if it cant be parsed
        const code = ERR_CODES.parseError;
        const errorMessage = ERR_MSGS.parseError;
        this._raiseError(errorMessage, code, null);
      } else if (!message.id) {
        // no id, so assume notification
        this.factory.emit(message.method, message);
      } else if (message.error) {
        // got an error back so reject the message
        const { id } = message;
        const { code } = message;
        const errorMessage = message.error;
        this._raiseError(errorMessage, code, id);
      } else if (!message.method) {
        // no method, so assume response
        this.serving_message_id = message.id;
        this.responseQueue[this.serving_message_id] = message;
        this.handleResponse(this.serving_message_id);
      } else {
        const code = ERR_CODES.unknown;
        const errorMessage = ERR_MSGS.unknown;
        this._raiseError(errorMessage, code, null);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        const id = this.serving_message_id;
        const code = ERR_CODES.parseError;
        const errorMessage = `Unable to parse errorMessage: '${chunk}'`;
        this._raiseError(errorMessage, code, id);
      } else {
        throw e;
      }
    }
  }

  handleBatch(message) {
    // possible batch request
    message.forEach((res) => {
      if (res && res.method && !res.id) {
        this.factory.emit(res.method, res);
      }
    });
    this.factory.emit("batchResponse", message);
  }

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

  handleResponse(id) {
    try {
      const response = this.getResponse(id);
      this.pendingCalls[id].resolve(response);
      delete this.responseQueue[id];
      this.factory.cleanUp(id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(e.message)}`
        );
      }
    }
  }

  getResponse(id) {
    return this.responseQueue[id];
  }

  request() {
    return {
      message: (method, params, id = true) => {
        const request = formatRequest({
          method,
          params,
          id: id ? this.message_id : undefined,
          options: this.factory.options
        });
        if (id) {
          this.message_id += 1;
        }
        return request;
      },

      send: (method, params) => new Promise((resolve, reject) => {
        const requestId = this.message_id;
        this.pendingCalls[requestId] = { resolve, reject };
        try {
          this.connector.write(this.request().message(method, params));
        } catch (e) {
          // this.connector is probably undefined
          reject(e);
        }
        this.factory.timeouts[requestId] = setTimeout(() => {
          this.factory.cleanUp(requestId);
          try {
            const error = JSON.parse(
              formatError({
                jsonrpc: this.version,
                delimiter: this.delimiter,
                id: null,
                code: ERR_CODES.timeout,
                message: ERR_MSGS.timeout
              })
            );
            this.pendingCalls[requestId].reject(error);
            delete this.pendingCalls[requestId];
          } catch (e) {
            if (e instanceof TypeError) {
              console.error(
                `Message has no outstanding calls: ${JSON.stringify(e)}`
              );
            }
          }
        }, this.factory.options.timeout);
      }),
      notify: (method, params) => {
        const request = formatRequest({
          method,
          params,
          options: this.factory.options
        });
        return new Promise((resolve, reject) => {
          try {
            this.connector.write(request, () => {
              resolve(request);
            });
          } catch (e) {
            // this.connector is probably undefined
            reject(e);
          }
        });
      }
    };
  }

  handleError(error) {
    let err;
    try {
      err = JSON.parse(error.message);
    } catch (e) {
      err = JSON.parse(
        formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.unknown,
          message: JSON.stringify(error, Object.getOwnPropertyNames(error))
        })
      );
    }
    this.factory.rejectPendingCalls(err);
  }
}

module.exports = JsonRpcClientProtocol;
