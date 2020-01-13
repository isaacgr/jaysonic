const EventEmitter = require("events");
const http = require("http");
const { ERR_CODES, ERR_MSGS } = require("../constants");
const { MessageBuffer } = require("../buffer");

/**
 * @class Client
 * @extends require('events').EventEmitter
 * @param {Object} [server] object with host and port of server
 * @param {Object} [options]
 * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
 * @param {String} [options.delimiter="\n"] delimiter to use for requests
 * @param {Number} [options.timeout=30] timeout for request
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
      timeout: 30,
      retries: 2
    };

    this.client = undefined;
    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};
    this.pendingBatches = {};
    this.attached = false;

    this.responseQueue = {};
    this.options = {
      ...defaults,
      ...(options || {})
    };
    this.options.timeout = this.options.timeout * 1000;

    /**
     * we can receive whole messages, or parital so we need to buffer
     *
     * whole message: {"jsonrpc": 2.0, "params": ["hello"], id: 1}
     *
     * partial message: {"jsonrpc": 2.0, "params"
     */
    this.messageBuffer = new MessageBuffer(this.options.delimiter);

    const { host, port } = this.options;
    this.server = { host, port };
  }

  // http client doesnt need this method
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

  batch() {
    throw new Error("function must be overwritten in subclass");
  }

  notify() {
    throw new Error("function must be overwritten in subsclass");
  }

  subscribe() {
    throw new Error("function must be overwritten in subsclass");
  }

  handleResponse(id) {
    if (!(this.pendingCalls[id] === undefined)) {
      let response = this.responseQueue[id];
      if (this.writer instanceof http.IncomingMessage) {
        // want to allow users to access the headers, status code etc.
        response = {
          body: this.responseQueue[id],
          ...this.writer
        };
      }
      this.pendingCalls[id].resolve(response);
      delete this.responseQueue[id];
    }
  }

  verifyData(chunk) {
    try {
      // will throw an error if not valid json
      const message = JSON.parse(chunk);
      if (Array.isArray(message)) {
        // possible batch request
        try {
          this.emit("batchResponse", message);
        } catch (e) {
          const error = this.formatError({
            id: null,
            code: ERR_CODES.parseError,
            message: ERR_MSGS.parseError
          });
          this.emit("batchError", error);
        }
      } else if (!(message === Object(message))) {
        // error out if it cant be parsed
        const error = this.formatError({
          id: null,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError
        });
        this.handleError(error);
      } else if (!message.id) {
        // special case http response since it cant get notifications
        // this is not in spec at all
        if (this.writer instanceof http.IncomingMessage) {
          const error = this.formatError({
            id: this.serving_message_id,
            code: ERR_CODES.parseError,
            message: ERR_MSGS.parseError
          });
          this.handleError(error);
        }
        // no id, so assume notification
        this.emit("notify", message);
      } else if (message.error) {
        // got an error back so reject the message
        const error = this.formatError({
          jsonrpc: message.jsonrpc,
          id: message.id,
          code: message.error.code,
          message: message.error.message
        });
        this.handleError(error);
      } else if (!message.method) {
        // no method, so assume response
        this.serving_message_id = message.id;
        this.responseQueue[this.serving_message_id] = message;
        this.handleResponse(this.serving_message_id);
      } else {
        throw new Error();
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        const error = this.formatError({
          id: this.serving_message_id,
          code: ERR_CODES.parseError,
          message: `Unable to parse message: '${chunk}'`
        });
        this.handleError(error);
      } else {
        const error = this.formatError({
          id: this.serving_message_id,
          code: ERR_CODES.internal,
          message: `Unable to parse message: '${chunk}'`
        });
        this.handleError(error);
      }
    }
  }

  listen() {
    this.writer.on("data", (data) => {
      if (this.writer instanceof http.IncomingMessage) {
        this.writer.on("end", () => {
          // may still want to know the data if there are errors
          this.writer.response = data.toString();
          this.handleData(data);
        });
      } else {
        this.handleData(data);
      }
    });
    this.client.on("close", () => {
      this.attached = false;
      this.client.removeAllListeners();
      this.emit("serverDisconnected");
    });
  }

  handleData(data) {
    this.messageBuffer.push(data);
    while (!this.messageBuffer.isFinished()) {
      const message = this.messageBuffer.handleData();
      this.verifyData(message);
    }
  }

  serverDisconnected(cb) {
    this.on("serverDisconnected", () => cb());
  }

  handleError(error) {
    let response = error;
    if (this.writer instanceof http.IncomingMessage) {
      // want to allow users to access the headers, status code etc.
      response = {
        body: error,
        ...this.writer
      };
    }
    try {
      this.pendingCalls[error.id].reject(response);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        process.stdout.write(
          `Message has no outstanding calls: ${JSON.stringify(error)}\n`
        );
      }
    }
  }

  formatError({ jsonrpc, id, code, message }) {
    let response;
    if (this.options.version === "2.0") {
      response = {
        jsonrpc: jsonrpc || this.options.version,
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

/**
 * WebSoket client constructor
 * @type ClientWS
 * @static
 */
Client.ws = require("./ws");
