const EventEmitter = require("events");
const _ = require("lodash");
const events = require("events");
const net = require("net");
const { formatRequest } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

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

class Client extends EventEmitter {
  constructor(options) {
    super();
    if (!(this instanceof Client)) {
      return new Client(options);
    }

    const defaults = {
      version: "2.0",
      delimiter: "\r\n"
    };

    const { host, port } = options;
    this.server = { host, port };
    this.client = undefined;
    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};
    this.attached = false;

    /**
     * we can receive whole messages, or parital so we need to buffer
     *
     * whole message: {"jsonrpc": 2.0, "params": ["hello"], id: 1}
     *
     * partial message: {"jsonrpc": 2.0, "params"
     */
    this.messageBuffer = "";
    this.responseQueue = {};
    this.options = _.merge(defaults, options || {});
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (this.attached) {
        reject(Error("client already connected"));
      }
      this.client = new net.Socket();
      this.client.connect(this.server);
      this.client.setEncoding("utf8");
      this.client.on("connect", () => {
        this.attached = true;
        /**
         * start listeners, response handlers and error handlers
         */
        this.listen();
        this.handleResponse();
        this.handleError();
        resolve(this.server);
      });
      this.client.on("error", (error) => {
        reject(error);
      });
    });
  }

  end() {
    return new Promise((resolve, reject) => {
      this.client.end((error) => {
        if (error) {
          reject();
        }
        resolve();
      });
    });
  }

  batch(requests) {
    /**
     * should receive a list of request objects
     * [client.request.message(), client.request.message()]
     * send a single request with that, server should handle it
     */
    const request = JSON.stringify(requests);
    return new Promise((resolve, reject) => {
      this.pendingCalls[this.message_id] = { resolve, reject };
      this.message_id += 1;
      this.client.write(request);
      this.on("batchResponse", (batch) => {
        resolve(batch);
      });
    });
  }

  subscribe() {
    throw new Error("function must be overwritten in subsclass");
  }

  handleResponse() {
    this.on("response", (id) => {
      if (!(this.pendingCalls[id] === undefined)) {
        this.pendingCalls[id].resolve(this.responseQueue[id]);
        delete this.responseQueue[id];
      }
    });
  }

  verifyData() {
    /**
     * want to search for whole messages by matching the delimiter from the start of the buffer
     */
    const messages = this.messageBuffer.split(this.options.delimiter);
    for (const chunk of messages) {
      try {
        // will throw an error if not valid json
        const message = JSON.parse(chunk);
        if (_.isArray(message)) {
          // batch response
          this.emit("batchResponse", message);
        }
        if (message.error) {
          // got an error back
          this.sendError(
            message.jsonrpc,
            message.id,
            message.error.code,
            message.error.message
          );
        }

        if (!message.id) {
          // no id, so notification
          this.emit("notify", message);
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
          if (this.messageBuffer.indexOf(chunk) === this.messageBuffer.length) {
            this.sendError(
              this.serving_message_id,
              ERR_CODES.parseError,
              ERR_MSGS.parseError
            );
          }
        }
      }
    }
  }

  listen() {
    this.client.on("data", (data) => {
      this.messageBuffer += data.trimLeft();
      this.verifyData();
    });
    this.client.on("end", () => {
      this.attached = false;
      this.client.removeAllListeners();
      this.emit("serverDisconnected");
    });
    this.client.on("close", () => {
      this.attached = false;
      this.client.removeAllListeners();
    });
  }

  serverDisconnected(cb) {
    this.on("serverDisconnected", () => cb());
  }

  handleError() {
    this.on("error", (error) => {
      this.pendingCalls[error.id].reject(error);
    });
  }

  sendError(jsonrpc = this.options.version, id, code, message = null) {
    const response = {
      jsonrpc,
      error: { code, message: message || "Unknown Error" },
      id
    };
    this.emit("error", response);
  }
}

Client.prototype.request = function() {
  return {
    message: (method, params) => {
      const request = formatRequest(
        method,
        params,
        this.message_id,
        this.options
      );
      this.message_id += 1;
      return request;
    },

    send: (method, params) => {
      return new Promise((resolve, reject) => {
        this.pendingCalls[this.message_id] = { resolve, reject };
        this.client.write(this.request().message(method, params));
      });
    }
  };
};

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
