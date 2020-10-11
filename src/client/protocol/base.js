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
    this.listener = undefined;
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
      const retryConnection = () => {
        this.setConnector();
        this.connector.connect(this.server);
        this.connector.setEncoding("utf8");
        this.connector.on("connect", () => {
          this.listener = this.connector;
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
              retryConnection();
            }, this.factory.connectionTimeout);
          } else {
            this.factory.pcolInstance = undefined;
            reject(error);
          }
        });
      };
      return retryConnection();
    });
  }

  end(cb) {
    this.factory.pcolInstance = undefined;
    this.connector.end(cb);
  }

  listen() {
    this.listener.on("data", (data) => {
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
        throw SyntaxError();
      } else if (!("id" in message)) {
        // no id, so assume notification
        this.handleNotification(message);
      } else if (message.error) {
        // got an error back so reject the message
        const { id } = message;
        const { code } = message.error;
        const errorMessage = message.error.message;
        this._raiseError(errorMessage, code, id);
      } else if (!message.method) {
        // no method, so assume response
        this.handleResponse(message);
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

  handleNotification(message) {
    this.factory.emit(message.method, message);
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

  handleResponse(message) {
    this.serving_message_id = message.id;
    this.responseQueue[message.id] = message;
    try {
      const response = this.getResponse(message.id);
      this.pendingCalls[message.id].resolve(response);
      delete this.responseQueue[message.id];
      this.factory.cleanUp(message.id);
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

  write(request, cb) {
    this.connector.write(request, cb);
  }

  message(method, params, id = true) {
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
  }

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

  request() {
    const self = this;
    return {
      message: this.message.bind(self),
      send: this.send.bind(self),
      notify: this.notify.bind(self)
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
        this.write(request + this.delimiter);
      } catch (e) {
        // this.connector is probably undefined
        reject(e.message);
      }
      this._timeoutPendingCalls(String(batchIds));
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
      const difference = arrays.reduce((a, b) => a.filter(c => !b.includes(c)));
      if (difference.length === 0) {
        this.factory.cleanUp(ids);
        this._resolveOrRejectBatch(batch, batchResponseIds);
      }
    }
  }

  getBatchResponse(batch) {
    return batch;
  }

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
          console.error(
            `Message has no outstanding calls: ${JSON.stringify(e)}`
          );
        }
      }
    }, this.factory.requestTimeout);
  }

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
