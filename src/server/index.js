const _ = require("lodash");
const events = require("events");
const net = require("net");
const { formatResult } = require("../functions");

ERR_CODES = {
  parseError: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603
};

ERR_MSGS = {
  parseError: "Parse Error",
  invalidRequest: "Invalid Request",
  methodNotFound: "Method not found",
  invalidParams: "Invalid parameters"
};

class Server {
  constructor(options) {
    if (!(this instanceof Server)) {
      return new Server(options);
    }

    const defaults = {
      host: "localhost",
      port: 8100,
      exclusive: false,
      version: 2,
      delimiter: "\r\n"
    };

    this.options = _.merge(defaults, options || {});
    this.messageBuffer = "";
    this.methods = {};
  }

  listen() {
    return new Promise((resolve, reject) => {
      const { host, port, exclusive } = this.options;
      this.server.listen({ host, port, exclusive });
      this.server.on("listening", () => {
        this.handleData();
        resolve({
          host: this.server.address().address,
          port: this.server.address().port
        });
      });
      this.server.on("error", error => reject(error));
    });
  }

  method(name, cb) {
    // add the method and its associated callback to the object
    this.methods[name] = cb;
  }

  validateRequest(message) {
    return new Promise((resolve, reject) => {
      try {
        // throws error if json invalid
        const json = JSON.parse(message);

        if (!json.id) {
          reject(
            this.send_error(
              null,
              ERR_CODES["invalidRequest"],
              ERR_MSGS["invalidRequest"]
            )
          );
        }
        if (!this.methods[json.method]) {
          reject(
            this.send_error(
              json.id,
              ERR_CODES["methodNotFound"],
              ERR_MSGS["methodNotFound"]
            )
          );
        }

        if (typeof json.params !== "object" || typeof json.params !== "array") {
          reject(
            this.send_error(
              json.id,
              ERR_CODES["invalidParams"],
              ERR_MSGS["invalidParams"]
            )
          );
        }
        if (this.methods[json.method].length !== json.params.length) {
          reject(
            this.send_error(
              json.id,
              ERR_CODES["invalidParams"],
              ERR_MSGS["invalidParams"]
            )
          );
        }
        // data looks good
        resolve({ valid: true, json });
      } catch (e) {
        if (e instanceof SyntaxError) {
          reject(
            this.send_error(
              null,
              ERR_CODES["parseError"],
              ERR_MSGS["parseError"]
            )
          );
        }
      }
    });
  }

  handleData() {
    throw new Error("function must be overwritten in subsclass");
  }

  getResult(message) {
    const parsed_message = JSON.parse(message);
    const params = parsed_message.params;
    return new Promise((resolve, reject) => {
      try {
        const result = this.methods[parsed_message.method](...params);
        resolve(formatResult(parsed_message, result));
      } catch (e) {
        console.log(e);
        const error = this.send_error(parsed_message.id, ERR_CODES["internal"]);
        reject(error);
      }
    });
  }

  send_error(id, code, message = null) {
    const response = {
      error: { code: code, message: message || "Unknown Error" },
      id: id
    };
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
