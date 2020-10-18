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
      this._validateData(chunk);
    }
  }

  _validateData(chunk) {
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
      this._raiseError(ERR_MSGS.invalidRequest, ERR_CODES.invalidRequest, null);
    } else if (!(typeof message.method === "string")) {
      this._raiseError(
        ERR_MSGS.invalidRequest,
        ERR_CODES.invalidRequest,
        message.id
      );
    } else if (!(message.method in this.factory.methods)) {
      this._raiseError(
        ERR_MSGS.methodNotFound,
        ERR_CODES.methodNotFound,
        message.id
      );
    } else if (
      message.params
      && !Array.isArray(message.params)
      && !(message.params === Object(message.params))
    ) {
      this._raiseError(
        ERR_MSGS.invalidParams,
        ERR_CODES.invalidParams,
        message.id
      );
    } else if (message.jsonrpc && this.version !== "2.0") {
      this._raiseError(
        ERR_MSGS.invalidRequest,
        ERR_CODES.invalidRequest,
        message.id
      );
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
        if (result instanceof Promise || typeof result.then === "function") {
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
        } else {
          error.code = ERR_CODES.unknown;
          error.message = ERR_MSGS.unknown;
        }
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
