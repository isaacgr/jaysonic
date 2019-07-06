const EventEmitter = require("events");
const _ = require("lodash");
const isObject = require("lodash/isObject");
const isArray = require("lodash/isArray");
const { formatResponse } = require("../functions");
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

    this.options = _.merge(defaults, options || {});
    this.messageBuffer = "";
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
        this.handleData();
        this.handleError();
        resolve({
          host: this.server.address().address,
          port: this.server.address().port
        });
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

  handleBatchRequest(batch) {
    return new Promise((resolve, reject) => {
      try {
        const requests = batch;
        const batchRequests = requests.map((request) =>
          this._validateMessage(request)
            .then((message) =>
              this.getResult(message)
                .then((result) => JSON.parse(result))
                .catch((error) => error)
            )
            .catch((error) => error)
        );
        Promise.all(batchRequests)
          .then((result) => {
            resolve(result);
          })
          .catch((error) => {
            reject(error);
          });
      } catch (e) {
        if (e instanceof SyntaxError) {
          reject(
            this.sendError(null, ERR_CODES.parseError, ERR_MSGS.parseError)
          );
        }
      }
    });
  }

  validateRequest(request) {
    return new Promise((resolve, reject) => {
      try {
        const message = JSON.parse(request);
        resolve(message);
      } catch (e) {
        reject(this.sendError(null, ERR_CODES.parseError, ERR_MSGS.parseError));
      }
    });
  }

  _validateMessage(message) {
    return new Promise((resolve, reject) => {
      if (_.isArray(message)) {
        // possible batch request
        if (_.isEmpty(message)) {
          const error = this.sendError(
            null,
            ERR_CODES.invalidRequest,
            ERR_MSGS.invalidRequest
          );
          return reject(error);
        }
        return this.handleBatchRequest(message)
          .then((responses) => {
            resolve({ batch: responses });
          })
          .catch((error) => {
            reject(JSON.stringify(error));
          });
      }

      if (!_.isObject(message)) {
        reject(
          this.sendError(
            null,
            ERR_CODES.invalidRequest,
            ERR_MSGS.invalidRequest
          )
        );
      }

      if (!message.id) {
        // no id, so assume notification
        this.emit("notify", message);
        resolve({ notification: message });
      }

      if (!_.isString(message.method)) {
        reject(
          this.sendError(
            message.id,
            ERR_CODES.invalidRequest,
            ERR_MSGS.invalidRequest
          )
        );
      }

      if (message.jsonrpc) {
        if (this.options.version !== "2.0") {
          reject(
            this.sendError(
              message.id,
              ERR_CODES.invalidRequest,
              ERR_MSGS.invalidRequest
            )
          );
        }
      }

      if (!this.methods[message.method]) {
        reject(
          this.sendError(
            message.id,
            ERR_CODES.methodNotFound,
            ERR_MSGS.methodNotFound
          )
        );
      }

      if (!isArray(message.params) && !isObject(message.params)) {
        reject(
          this.sendError(
            message.id,
            ERR_CODES.invalidParams,
            ERR_MSGS.invalidParams
          )
        );
      }
      // data looks good
      resolve(message);
    });
  }

  getResult(message) {
    const { params } = message;
    return new Promise((resolve, reject) => {
      try {
        const result = this.methods[message.method](params);
        const response = formatResponse({
          jsonrpc: message.jsonrpc,
          id: message.id,
          result
        });
        resolve(response);
      } catch (e) {
        let error = this.sendError(message.id, ERR_CODES.internal);
        if (e instanceof TypeError) {
          error = this.sendError(
            message.id,
            ERR_CODES.invalidParams,
            ERR_MSGS.invalidParams
          );
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
      return error;
    });
  }

  sendError(id, code, message = null) {
    let response;
    if (this.options.version === "2.0") {
      response = {
        jsonrpc: this.options.version,
        error: { code, message: message || "Unknown Error" },
        id
      };
    } else {
      response = {
        result: null,
        error: { code, message: message || "Unknown Error" },
        id
      };
    }
    return response;
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
