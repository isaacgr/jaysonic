const _ = require("lodash");
const events = require("events");
const net = require("net");
const { formatRequest } = require("../functions");

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
        resolve({ host, port });
      });
      this.server.on("error", error => reject(error));
    });
  }

  method(name, cb) {
    // add the method and its associated callback to the object
    this.methods[name] = cb;
  }

  validateRequest(message) {
    try {
      // throws error if json invalid
      const json = JSON.parse(message);

      if (!json.id) {
        send_error(
          null,
          ERR_CODES["invalidRequest"],
          ERR_MSGS["invalidRequest"]
        );
      }
      if (!this.methods[json.method]) {
        send_error(
          null,
          ERR_CODES["methodNotFound"],
          ERR_MSGS["methodNotFound"]
        );
      }
      // data looks good
      return true;
    } catch (e) {
      if (e instanceof SyntaxError) {
        send_error(null, ERR_CODES["parseError"], ERR_MSGS["parseError"]);
      }
    }
  }

  handleData() {
    throw new Error("function must be overwritten in subsclass");
  }

  getResult(message) {
    message.forEach(request => {
      const message = JSON.parse(request);
      const params = message.params;
      const result = this.methods[message.method](...params);
      return result;
    });
  }

  send_error(id, code, message = null) {
    const response = {
      error: { code: code, message: message || "Unknown Error" },
      id: id
    };
    this.emit("error", response);
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
