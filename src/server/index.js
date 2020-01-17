const EventEmitter = require("events");
const { formatResponse, formatError, BatchRequest } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

/**
 * @class Server
 * @extends require('events').EventEmitter
 * @param {Object} [host] host IP to connect with
 * @param {Object} [host] host port to connect with
 * @param {Object} [options]
 * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
 * @param {String} [options.delimiter="\n"] delimiter to use for requests
 * @param {Boolean} [options.exlusive=false] disallow port sharing
 * @return {Client}
 */
class Server extends EventEmitter {
  constructor(options) {
    super();
    if (!(this instanceof Server)) {
      return new Server(options);
    }

    const defaults = {
      host: "localhost",
      port: 8100,
      exclusive: false,
      version: "2.0",
      delimiter: "\n"
    };

    this.options = {
      ...defaults,
      ...(options || {})
    };

    this.methods = {};
    this.listening = false;
  }

  listen() {
    return new Promise((resolve, reject) => {
      if (this.listening) {
        // not having this caused MaxEventListeners error
        reject(Error("server already listening"));
      }
      const { host, port, exclusive } = this.options;
      this.server.listen({ host, port, exclusive });
      this.server.on("listening", () => {
        this.listening = true;
        try {
          this.handleData();
          this.handleError();
          resolve({
            host: this.server.address().address,
            port: this.server.address().port
          });
        } catch (e) {
          this.listening = false;
          reject(e);
        }
      });
      this.server.on("error", (error) => {
        this.listening = false;
        reject(error);
      });
      this.server.on("close", () => {
        this.listening = false;
      });
    });
  }

  close() {
    this.listening = false;
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject();
        }
        resolve();
      });
    });
  }

  method(name, cb) {
    // add the method and its associated callback to the object
    this.methods[name] = cb;
  }

  onNotify(method, cb) {
    this.on("notify", (message) => {
      try {
        if (message.method === method) {
          return cb(undefined, message);
        }
      } catch (e) {
        return cb(e);
      }
    });
  }

  handleData() {
    throw new Error("function must be overwritten in subsclass");
  }

  handleBatchRequest(requests) {
    const batchRequests = requests.map((request) => {
      try {
        const message = this.validateMessage(request);
        return this.getResult(message)
          .then(result => JSON.parse(result))
          .catch((error) => {
            throw error;
          });
      } catch (e) {
        return Promise.reject(e);
      }
    });
    return Promise.all(
      batchRequests.map(promise => promise.catch(error => JSON.parse(error.message)))
    );
  }

  validateRequest(request) {
    try {
      const message = JSON.parse(request);
      return message;
    } catch (e) {
      throw new Error(
        formatError({
          jsonrpc: this.options.version,
          id: null,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError,
          delimiter: this.options.delimiter
        })
      );
    }
  }

  validateMessage(message) {
    if (Array.isArray(message)) {
      // possible batch request
      if (message.length === 0) {
        const error = formatError({
          jsonrpc: this.options.version,
          id: null,
          code: ERR_CODES.invalidRequest,
          message: ERR_MSGS.invalidRequest,
          delimiter: this.options.delimiter
        });
        throw new Error(error);
      }
      throw new BatchRequest(undefined, message);
    }

    if (!(message === Object(message))) {
      throw new Error(
        formatError({
          jsonrpc: this.options.version,
          id: null,
          code: ERR_CODES.invalidRequest,
          message: ERR_MSGS.invalidRequest,
          delimiter: this.options.delimiter
        })
      );
    }

    if (!(typeof message.method === "string")) {
      throw new Error(
        formatError({
          jsonrpc: message.jsonrpc,
          id: message.id,
          code: ERR_CODES.invalidRequest,
          message: ERR_MSGS.invalidRequest,
          delimiter: this.options.delimiter
        })
      );
    }

    if (!message.id) {
      // no id, so assume notification
      return { notification: message };
    }

    if (message.jsonrpc) {
      if (this.options.version !== "2.0") {
        throw new Error(
          formatError({
            id: message.id,
            code: ERR_CODES.invalidRequest,
            message: ERR_MSGS.invalidRequest,
            delimiter: this.options.delimiter
          })
        );
      }
    }

    if (!this.methods[message.method]) {
      throw new Error(
        formatError({
          jsonrpc: message.jsonrpc,
          id: message.id,
          code: ERR_CODES.methodNotFound,
          message: ERR_MSGS.methodNotFound,
          delimiter: this.options.delimiter
        })
      );
    }

    if (
      !Array.isArray(message.params)
      && !(message.params === Object(message.params))
    ) {
      throw new Error(
        formatError({
          jsonrpc: message.jsonrpc,
          id: message.id,
          code: ERR_CODES.invalidParams,
          message: ERR_MSGS.invalidParams,
          delimiter: this.options.delimiter
        })
      );
    }
    // data looks good
    return message;
  }

  handleValidation(chunk) {
    return new Promise((resolve, reject) => {
      try {
        const result = this.validateRequest(chunk);
        const message = this.validateMessage(result);
        resolve(message);
      } catch (e) {
        if (e instanceof BatchRequest) {
          this.handleBatchRequest(e.request)
            .then((result) => {
              resolve({ batch: result });
            })
            .catch((error) => {
              reject(error);
            });
        } else {
          reject(e);
        }
      }
    });
  }

  getResult(message) {
    // function needs to be async since the method can be a promise
    return new Promise((resolve, reject) => {
      const { params } = message;
      let error = formatError({
        jsonrpc: message.jsonrpc,
        id: message.id,
        code: ERR_CODES.internal,
        message: ERR_CODES.unknown,
        delimiter: this.options.delimiter
      });
      try {
        const result = this.methods[message.method](params);
        if (typeof result.then === "function" || result instanceof Promise) {
          Promise.all([result])
            .then((results) => {
              resolve(
                formatResponse({
                  jsonrpc: message.jsonrpc,
                  id: message.id,
                  result: results || {},
                  delimiter: this.options.delimiter
                })
              );
            })
            .catch((resError) => {
              error = formatError({
                jsonrpc: message.jsonrpc,
                id: message.id,
                code: ERR_CODES.internal,
                message: `${JSON.stringify(resError.message || resError)}`,
                delimiter: this.options.delimiter
              });
              reject(error);
            });
        } else {
          resolve(
            formatResponse({
              jsonrpc: message.jsonrpc,
              id: message.id,
              result: result || {},
              delimiter: this.options.delimiter
            })
          );
        }
      } catch (e) {
        if (e instanceof TypeError) {
          error = formatError({
            jsonrpc: message.jsonrpc,
            id: message.id,
            code: ERR_CODES.invalidParams,
            message: ERR_MSGS.invalidParams,
            delimiter: this.options.delimiter
          });
        }
        reject(error);
      }
    });
  }

  clientConnected() {
    throw new Error("function must be overwritten in subclass");
  }

  clientDisconnected() {
    throw new Error("function must be overwritten in subsclass");
  }

  handleError() {
    this.on("error", (error) => {
      this.listening = false;
      throw error;
    });
  }
}

module.exports = Server;

/**
 * HTTP server constructor
 * @type ServerHTTP
 * @static
 */
Server.http = require("./http");

/**
 * TCP server constructor
 * @type ServerTCP
 * @static
 */
Server.tcp = require("./tcp");

/**
 * WS server constructor
 * @type ServerWS
 * @static
 */
Server.ws = require("./ws");
