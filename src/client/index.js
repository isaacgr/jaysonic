const _ = require("lodash");
const events = require("events");
const net = require("net");
const { formatRequest } = require("../functions");

/**
 * @class Client
 * @extends require('events').EventEmitter
 * @param {Object} [server] object with host and port of server
 * @param {Object} [options]
 * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
 * @param {String} [options.delimiter="\r\n"] delimiter to use for requests
 * @param {Boolean} [options.persist=true] persist the connection to server after a request
 * @return {Client}
 */

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

class Client {
  constructor(server, options) {
    if (!(this instanceof Client)) {
      return new Client(options);
    }

    const defaults = {
      version: 2,
      delimiter: "\r\n"
    };

    this.server = server;
    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};

    /**
     * we can receive whole messages, or parital so we need to buffer
     *
     * whole message: {"jsonrpc": 2.0, "params": ["hello"], id: 1}
     *
     * partial message: {"jsonrpc": 2.0, "params"
     */
    this.messageBuffer = "";
    this.notifications = {};
    this.responseQueue = {};
    this.options = _.merge(defaults, options || {});
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      this.client.connect(this.server);
      this.client.setEncoding("utf8");
      this.client.on("connect", () => {
        /**
         * start listeners, response handlers and error handlers
         */
        this._listen();
        this._handle_response();
        this._handle_error();
        resolve(this.server);
      });
      this.client.on("error", error => {
        reject(error);
      });
    });
  }

  end() {
    return Promise.resolve(this.client.end());
  }

  request(method, params) {
    const req_promise = new Promise((resolve, reject) => {
      const clientMessage = formatRequest(
        method,
        params,
        this.message_id,
        this.options
      );
      this.pendingCalls[this.message_id] = { resolve, reject };
      this.message_id += 1;
      this.client.write(clientMessage);
    });

    return req_promise;
  }

  notify(methods) {
    this.on("notify", notifyMethod => {
      const params = this.notifications[notifyMethod].params;
      methods[notifyMethod](params);
    });
  }

  _handle_response() {
    this.on("response", id => {
      if (!(this.pendingCalls[id] === undefined)) {
        this.pendingCalls[id].resolve(this.responseQueue[id]);
        delete this.responseQueue[id];
      }
    });
  }

  _handle_error() {
    this.on("error", error => {
      this.pendingCalls[error.id].reject(error);
    });
  }

  _listen() {
    this.client.on("data", data => {
      this.messageBuffer += data.trimLeft();
      /**
       * want to search for whole messages by matching the delimiter from the start of the buffer
       */
      const messages = this.messageBuffer.split(this.options.delimiter);
      for (let chunk of messages) {
        try {
          // will throw an error if not valid json
          const message = JSON.parse(chunk);
          if (message.error) {
            // got an error back
            this.send_error(
              message.id,
              message.error.code,
              message.error.message
            );
          }

          if (!message.id) {
            // no id, so notification
            this.notifications[method] = message;
            this.emit("notify", method);
          }

          // no method, so response
          if (!message.method) {
            this.serving_message_id = message.id;
            this.responseQueue[this.serving_message_id] = message;
            this.emit("response", this.serving_message_id);
          }
        } catch (e) {
          if (e instanceof SyntaxError) {
            // if we've gotten all chunks, and json is still invalid throw error
            if (
              this.messageBuffer.indexOf(chunk) === this.messageBuffer.length
            ) {
              this.send_error(
                this.serving_message_id,
                ERR_CODES["parseError"],
                ERR_MSGS["parseError"]
              );
            }
          }
        }
      }
    });
    this.client.on("end", () => {
      console.warn("Other side closed connection");
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
require("util").inherits(Client, events.EventEmitter);

module.exports = Client;

/**
 * TCP client constructor
 * @type ClientTcp
 * @static
 */
Client.tcp = require("./tcp");

/**
 * HTTP client constructor
 * @type ClientHTTP
 * @static
 */
Client.http = require("./http");
