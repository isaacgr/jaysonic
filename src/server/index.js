const events = require("events");
const _ = require("lodash");
const isObject = require("lodash/isObject");
const isArray = require("lodash/isArray");
const { formatResponse } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");
class Server {
  constructor(options) {
    if (!(this instanceof Server)) {
      return new Server(options);
    }

    const defaults = {
      host: "localhost",
      port: 8100,
      exclusive: false,
      version: "2.0",
      delimiter: "\r\n"
    };

    this.options = _.merge(defaults, options || {});
    this.messageBuffer = "";
    this.methods = {};
    this.listening = false;
  }

  listen() {
    return new Promise((resolve, reject) => {
      if (this.listening) {
        reject("server already listening");
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

  handleData() {
    throw new Error("function must be overwritten in subsclass");
  }

  validateRequest(message) {
    return new Promise((resolve, reject) => {
      try {
        // throws error if json invalid
        const json = JSON.parse(message);
        if (!json.id) {
          reject(
            this.sendError(
              null,
              ERR_CODES.invalidRequest,
              ERR_MSGS.invalidRequest
            )
          );
        }

        if (json.jsonrpc) {
          if (this.options.version !== "2.0") {
            reject(
              this.sendError(
                json.id,
                ERR_CODES.invalidRequest,
                ERR_MSGS.invalidRequest
              )
            );
          }
        }

        if (!this.methods[json.method]) {
          reject(
            this.sendError(
              json.id,
              ERR_CODES.methodNotFound,
              ERR_MSGS.methodNotFound
            )
          );
        }

        if (!isArray(json.params) && !isObject(json.params)) {
          reject(
            this.sendError(
              json.id,
              ERR_CODES.invalidParams,
              ERR_MSGS.invalidParams
            )
          );
        }
        // data looks good
        resolve({ valid: true, json });
      } catch (e) {
        if (e instanceof SyntaxError) {
          reject(
            this.sendError(null, ERR_CODES.parseError, ERR_MSGS.parseError)
          );
        }
      }
    });
  }

  getResult(message) {
    const { params } = message;
    return new Promise((resolve, reject) => {
      try {
        const result = this.methods[message.method](params);
        resolve(formatResponse(message, result));
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
      error;
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
require("util").inherits(Server, events.EventEmitter);

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
