const { MessageBuffer } = require("../../buffer");
const { formatResponse, formatError } = require("../../functions");
const { ERR_CODES, ERR_MSGS } = require("../../constants");

class JsonRpcServerProtocol {
  // base protocol class for servers
  constructor(factory, client, version, delimiter) {
    this.client = client;
    this.factory = factory;
    this.delimiter = delimiter;
    this.version = version;
    this.messageBuffer = new MessageBuffer(delimiter);
    this.event = "data";
  }

  clientConnected() {
    this.client.on(this.event, (data) => {
      this.messageBuffer.push(data);
      this._waitForData();
    });
    this.client.on("close", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
    this.client.on("end", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
  }

  _waitForData() {
    while (!this.messageBuffer.isFinished()) {
      const chunk = this.messageBuffer.handleData();
      try {
        const result = this.validateRequest(chunk);
        const isMessage = this.maybeHandleRequest(result);
        if (isMessage) {
          this.handleRequest(result);
        }
      } catch (e) {
        this.handleError(e);
      }
    }
  }

  validateRequest(request) {
    try {
      return JSON.parse(request);
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

  maybeHandleRequest(result) {
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
      this.handleBatchRequest(result).then((res) => {
        this.writeToClient(JSON.stringify(res) + this.delimiter);
      });
    } else if (result === Object(result) && !("id" in result)) {
      // no id, so assume notification
      this.handleNotification(result);
    } else {
      this.validateMessage(result);
      return true;
    }
  }

  validateMessage(message) {
    if (!(message === Object(message))) {
      const code = ERR_CODES.invalidRequest;
      const errorMessage = ERR_MSGS.invalidRequest;
      this._raiseError(errorMessage, code, null);
    } else if (!(typeof message.method === "string")) {
      const code = ERR_CODES.invalidRequest;
      const errorMessage = ERR_MSGS.invalidRequest;
      const { id } = message;
      this._raiseError(errorMessage, code, id);
    } else if (!(message.method in this.factory.methods)) {
      const code = ERR_CODES.methodNotFound;
      const errorMessage = ERR_MSGS.methodNotFound;
      const { id } = message;
      this._raiseError(errorMessage, code, id);
    } else if (
      message.params
      && !Array.isArray(message.params)
      && !(message.params === Object(message.params))
    ) {
      const code = ERR_CODES.invalidParams;
      const errorMessage = ERR_MSGS.invalidParams;
      const { id } = message;
      this._raiseError(errorMessage, code, id);
    } else if (message.jsonrpc && this.version !== "2.0") {
      const code = ERR_CODES.invalidRequest;
      const errorMessage = ERR_MSGS.invalidRequest;
      const { id } = message;
      this._raiseError(errorMessage, code, id);
    }
  }

  writeToClient(message) {
    this.client.write(message);
  }

  handleNotification(message) {
    this.factory.emit(message.method, message);
  }

  handleRequest(message) {
    this.getResult(message)
      .then((result) => {
        this.writeToClient(result);
      })
      .catch((error) => {
        this.handleError(Error(error));
      });
  }

  handleBatchRequest(requests) {
    const batchResponses = requests
      .map((request) => {
        try {
          this.maybeHandleRequest(request);
          return this.getResult(request)
            .then(result => JSON.parse(result))
            .catch(error => JSON.parse(error));
        } catch (e) {
          // basically reject the whole batch if any one thing fails
          return JSON.parse(e.message);
        }
      })
      .filter(el => el != null);
    return Promise.all(batchResponses);
  }

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
        const result = params
          ? this.factory.methods[message.method](params)
          : this.factory.methods[message.method]();
        if (
          result
          && (typeof result.then === "function" || result instanceof Promise)
        ) {
          Promise.all([result])
            .then((results) => {
              response.result = results || 0;
              resolve(formatResponse(response));
            })
            .catch((resError) => {
              error.code = ERR_CODES.internal;
              error.message = `${JSON.stringify(resError.message || resError)}`;
              reject(formatError(error));
            });
        } else {
          response.result = result || 0;
          resolve(formatResponse(response));
        }
      } catch (e) {
        if (e instanceof TypeError) {
          error.code = ERR_CODES.invalidParams;
          error.message = ERR_MSGS.invalidParams;
          reject(formatError(error));
        }
        error.code = ERR_CODES.unknown;
        error.message = ERR_MSGS.unknown;
        reject(formatError(error));
      }
    });
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
      err = JSON.stringify(JSON.parse(error.message));
    } catch (e) {
      err = formatError({
        jsonrpc: this.version,
        delimiter: this.delimiter,
        id: null,
        code: ERR_CODES.unknown,
        message: JSON.stringify(error, Object.getOwnPropertyNames(error))
      });
    }
    this.writeToClient(err + this.delimiter);
  }
}

module.exports = JsonRpcServerProtocol;
