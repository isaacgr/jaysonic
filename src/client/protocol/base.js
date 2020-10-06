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
    this.responseQueue = {};
    this.server = this.factory.server;
    this.messageBuffer = new MessageBuffer(this.delimiter);
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connector = new net.Socket();
      this.connector.connect(this.server);
      this.connector.setEncoding("utf8");
      this.connector.on("connect", () => {
        this.listen();
        resolve(this.server);
      });
      this.connector.on("error", (error) => {
        if (error.code === "ECONNREFUSED" && this.factory.remainingRetries) {
          this.factory.remainingRetries -= 1;
          console.error(
            `Unable to connect. Retrying. ${this.factory.remainingRetries} attempts left.`
          );
          setTimeout(() => {
            this.connect(this.server);
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
        const { code } = message.error;
        const errorMessage = message.error.message;
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
        const errorMessage = `Unable to parse message: '${chunk}'`;
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
    this.gotBatchResponse(message);
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

      send: (method, params) =>
        new Promise((resolve, reject) => {
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
          }, this.factory.requestTimeout);
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

  /**
   * should receive a list of request objects
   * [client.request.message(), client.request.message()]
   * send a single request with that, server should handle it
   *
   * We want to store the IDs for the requests in the batch in an array
   * Use this to reference the batch response
   * The spec has no explaination on how to do that, so this is the solution
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
        this.connector.write(request + this.delimiter);
      } catch (e) {
        // this.connector is probably undefined
        reject(e.message);
      }
      this.factory.timeouts[String(batchIds)] = setTimeout(() => {
        this._timeoutPendingCalls(String(batchIds));
      }, this.factory.requestTimeout);
    });
  }

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
      const difference = arrays.reduce((a, b) =>
        a.filter((c) => !b.includes(c))
      );
      if (difference.length === 0) {
        this.factory.cleanUp(ids);
        this._resolveOrRejectBatch(batch, batchResponseIds);
      }
    }
  }

  _timeoutPendingCalls(id) {
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
        console.error(`Message has no outstanding calls: ${JSON.stringify(e)}`);
      }
    }
  }

  _resolveOrRejectBatch(batch, batchIds) {
    try {
      const invalidBatches = [];
      batch.forEach((message) => {
        if (message.error) {
          // reject the whole message if there are any errors
          this.pendingCalls[batchIds].reject(batch);
          invalidBatches.push(batchIds);
        }
      });
      if (invalidBatches.length !== 0) {
        invalidBatches.forEach((id) => {
          delete this.pendingCalls[id];
        });
      } else {
        this.pendingCalls[batchIds].resolve(batch);
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

  handleError(error) {
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

  rejectPendingCalls(error) {
    try {
      this.pendingCalls[error.id].reject(error);
      this.factory.cleanUp(error.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(error)}`
        );
      }
    }
  }
}

module.exports = JsonRpcClientProtocol;
