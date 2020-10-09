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
      this.handleValidation(chunk)
        .then((message) => {
          // batch notifications can return 'undefined'
          if (message) {
            this.handleValidMessage(message);
          }
        })
        .catch((error) => {
          this.sendError(error.message);
        });
    }
  }

  handleValidation(chunk) {
    return new Promise((resolve, reject) => {
      try {
        const result = this.validateRequest(chunk);
        const message = this.validateMessage(result);
        resolve(message);
      } catch (e) {
        reject(e);
      }
    });
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

  validateMessage(message) {
    if (Array.isArray(message)) {
      // possible batch request
      return this.handleBatchRequest(message);
    } else if (!(message === Object(message))) {
      const code = ERR_CODES.invalidRequest;
      const errorMessage = ERR_MSGS.invalidRequest;
      this._raiseError(errorMessage, code, null);
    } else if (!message.id) {
      // no id, so assume notification
      return { notification: message };
    } else if (!(typeof message.method === "string")) {
      const code = ERR_CODES.invalidRequest;
      const errorMessage = ERR_MSGS.invalidRequest;
      const id = message.id;
      this._raiseError(errorMessage, code, id);
    } else if (!(message.method in this.factory.methods)) {
      const code = ERR_CODES.methodNotFound;
      const errorMessage = ERR_MSGS.methodNotFound;
      const id = message.id;
      this._raiseError(errorMessage, code, id);
    } else if (
      message.params &&
      !Array.isArray(message.params) &&
      !(message.params === Object(message.params))
    ) {
      const code = ERR_CODES.invalidParams;
      const errorMessage = ERR_MSGS.invalidParams;
      const id = message.id;
      this._raiseError(errorMessage, code, id);
    } else if (message.jsonrpc) {
      if (this.version !== "2.0") {
        const code = ERR_CODES.invalidRequest;
        const errorMessage = ERR_MSGS.invalidRequest;
        const id = message.id;
        this._raiseError(errorMessage, code, id);
      } else {
        // data looks good
        return message;
      }
    } else {
      return message;
    }
  }

  handleValidMessage(message) {
    if (Array.isArray(message)) {
      this.writeToClient(JSON.stringify(message) + this.delimiter);
    } else if (message.notification) {
      this.writeToClient(message, message.notification);
    } else {
      this.getResult(message)
        .then((result) => {
          this.writeToClient(result);
        })
        .catch((error) => {
          this.sendError(error);
        });
    }
  }

  writeToClient(message, notification) {
    if (notification) {
      this.factory.emit(message.notification.method, notification);
    } else {
      this.client.write(message);
    }
  }

  handleBatchRequest(requests) {
    const batchRequests = requests
      .map((request) => {
        try {
          const message = this.validateMessage(request);
          if (message.notification) {
            this.factory.emit(
              message.notification.method,
              message.notification
            );
          } else {
            return this.getResult(message)
              .then((result) => JSON.parse(result))
              .catch((error) => {
                throw error;
              });
          }
        } catch (e) {
          return Promise.reject(e);
        }
      })
      .filter((el) => el != null);
    if (batchRequests.length === 0) {
      return;
    }
    return Promise.all(
      batchRequests.map((promise) =>
        promise.catch((error) => JSON.parse(error.message))
      )
    );
  }

  getResult(message) {
    // function needs to be async since the method can be a promise
    return new Promise((resolve, reject) => {
      const { params } = message;
      try {
        const result = params
          ? this.factory.methods[message.method](params)
          : this.factory.methods[message.method]();
        if (
          result &&
          (typeof result.then === "function" || result instanceof Promise)
        ) {
          Promise.all([result])
            .then((results) => {
              resolve(
                formatResponse({
                  jsonrpc: message.jsonrpc,
                  id: message.id,
                  result: results || 0,
                  delimiter: this.delimiter
                })
              );
            })
            .catch((resError) => {
              const error = formatError({
                jsonrpc: message.jsonrpc,
                id: message.id,
                code: ERR_CODES.internal,
                message: `${JSON.stringify(resError.message || resError)}`,
                delimiter: this.delimiter
              });
              reject(error);
            });
        } else {
          resolve(
            formatResponse({
              jsonrpc: message.jsonrpc,
              id: message.id,
              result: result || 0,
              delimiter: this.delimiter
            })
          );
        }
      } catch (e) {
        if (e instanceof TypeError) {
          reject(
            formatError({
              jsonrpc: message.jsonrpc,
              id: message.id,
              code: ERR_CODES.invalidParams,
              message: ERR_MSGS.invalidParams,
              delimiter: this.delimiter
            })
          );
        }
        reject(
          formatError({
            jsonrpc: message.jsonrpc,
            id: message.id,
            code: ERR_CODES.unknown,
            message: ERR_MSGS.unknown,
            delimiter: this.delimiter
          })
        );
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

  sendError(error) {
    this.writeToClient(error);
  }
}

module.exports = JsonRpcServerProtocol;
