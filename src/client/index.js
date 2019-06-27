const EventEmitter = require("events");
const _ = require("lodash");
const { formatRequest } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

/**
 * @class Client
 * @extends require('events').EventEmitter
 * @param {Object} [server] object with host and port of server
 * @param {Object} [options]
 * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
 * @param {String} [options.delimiter="\n"] delimiter to use for requests
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
      host: "127.0.0.1",
      port: "8100",
      version: "2.0",
      delimiter: "\n",
      timeout: 30
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
    this.options.timeout = this.options.timeout * 1000;
  }

  connect() {
    throw new Error("function must be overwritten in subclass");
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

  request() {
    throw new Error("function must be overwritten in subclass");
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
      this.client.write(request);
      this.on("batchResponse", (batch) => {
        batch.forEach((message) => {
          if (message.error) {
            // reject the whole message if there are any errors
            reject(batch);
          }
        });
        resolve(batch);
      });
      this.on("batchError", (error) => {
        reject(error);
      });
    });
  }

  notify() {
    throw new Error("function must be overwritten in subsclass");
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

  verifyData(messages) {
    /**
     * want to search for whole messages by matching the delimiter from the start of the buffer
     */
    for (const chunk of messages) {
      try {
        if (chunk !== "") {
          // will throw an error if not valid json
          const message = JSON.parse(chunk);

          if (_.isArray(message)) {
            // possible batch request
            try {
              const batch = JSON.parse(messages);
              return this.emit("batchResponse", batch);
            } catch (e) {
              const error = this.sendError({
                id: this.serving_message_id,
                code: ERR_CODES.parseError,
                message: ERR_MSGS.parseError
              });
              return this.emit("batchError", error);
            }
          }

          if (!message.id) {
            // no id, so assume notification
            return this.emit("notify", message);
          }

          if (message.error) {
            // got an error back
            const error = this.sendError({
              jsonrpc: message.jsonrpc,
              id: message.id,
              code: message.error.code,
              message: message.error.message
            });
            return this.emit("messageError", error);
          }

          // no method, so assume response
          if (!message.method) {
            this.serving_message_id = message.id;
            this.responseQueue[this.serving_message_id] = message;
            return this.emit("response", this.serving_message_id);
          }
        }
      } catch (e) {
        const error = this.sendError({
          id: this.serving_message_id,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError
        });
        return this.emit("messageError", error);
      }
    }
  }

  listen() {
    this.writer.on("data", (data) => {
      this.messageBuffer += data;
      const messages = this.messageBuffer.split(this.options.delimiter);
      this.messageBuffer = "";
      this.verifyData(messages);
    });
    this.writer.on("end", () => {
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
    this.on("messageError", (error) => {
      this.pendingCalls[error.id].reject(error);
    });
  }

  sendError({ jsonrpc, id, code, message }) {
    const response = {
      jsonrpc: jsonrpc || this.options.version,
      error: { code, message: message || "Unknown Error" },
      id
    };
    return response;
  }
}
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
