const EventEmitter = require("events");
const http = require("http");
const { formatError } = require("../functions");
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
      connectionTimeout: 5000,
      retries: 2
    };

    this.client = undefined;
    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};
    this.pendingBatches = {};
    this.connected = false;
    this.timeouts = {};
    this.listeners = {};
    this.responseQueue = {};

    this.options = {
      ...defaults,
      ...(options || {})
    };
    this.options.timeout = this.options.timeout * 1000;
    this.remainingRetries = this.options.retries;

    this.messageBuffer = new MessageBuffer(this.options.delimiter);

    const { host, port } = this.options;
    this.server = { host, port };
  }

  // http client doesnt need this method
  connect() {
    throw new Error("function must be overwritten in subclass");
  }

  end() {
    throw new Error("function must be overwritten in subclass");
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
    try {
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
      this.cleanUp(id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(e.message)}`
        );
      }
    }
  }

  verifyData(chunk) {
    try {
      // will throw an error if not valid json
      const message = JSON.parse(chunk);
      if (Array.isArray(message)) {
        // possible batch request
        message.forEach((res) => {
          if (res && res.method && !res.id) {
            this.emit(res.method, res);
          }
        });
        this.emit("batchResponse", message);
      } else if (!(message === Object(message))) {
        // error out if it cant be parsed
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError
        });
        throw new Error(error);
      } else if (!message.id) {
        // no id, so assume notification
        // special case http response since it cant get notifications
        // this is not in spec at all
        if (this.writer instanceof http.IncomingMessage) {
          const error = formatError({
            jsonrpc: this.options.version,
            delimiter: this.options.delimiter,
            id: this.serving_message_id,
            code: ERR_CODES.parseError,
            message: ERR_MSGS.parseError
          });
          throw new Error(error);
        }
        this.emit(message.method, message);
      } else if (message.error) {
        // got an error back so reject the message
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: message.id,
          code: message.error.code,
          message: message.error.message
        });
        throw new Error(error);
      } else if (!message.method) {
        // no method, so assume response
        this.serving_message_id = message.id;
        this.responseQueue[this.serving_message_id] = message;
        this.handleResponse(this.serving_message_id);
      } else {
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.unknown,
          message: ERR_MSGS.unknown
        });
        throw new Error(error);
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        const error = formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: this.serving_message_id,
          code: ERR_CODES.parseError,
          message: `Unable to parse message: '${chunk}'`
        });
        throw new Error(error);
      } else {
        throw e;
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
    // http client handles this when a request is sent out
    // prevents max listeners warning
    if (!(this.writer instanceof http.IncomingMessage)) {
      this.client.on("close", () => {
        this.connected = false;
        this.client.removeAllListeners();
        this.emit("serverDisconnected");
      });
    }
  }

  handleData(data) {
    this.messageBuffer.push(data);
    while (!this.messageBuffer.isFinished()) {
      const message = this.messageBuffer.handleData();
      try {
        this.verifyData(message);
      } catch (e) {
        this.handleError(e);
      }
    }
  }

  serverDisconnected(cb) {
    this.on("serverDisconnected", () => cb());
  }

  cleanUp(ids) {
    // remove the batchResponse listener and clear pending
    // timeouts for these request ids
    try {
      this.removeListener("batchResponse", this.listeners[ids]);
    } catch (e) {
      // no batch response listener associated with the ids
    }
    clearTimeout(this.timeouts[ids]);
    delete this.listeners[ids];
    delete this.timeouts[ids];
  }

  handleError(error) {
    let err;
    try {
      err = JSON.parse(error.message);
    } catch (e) {
      err = JSON.parse(
        formatError({
          jsonrpc: this.options.version,
          delimiter: this.options.delimiter,
          id: null,
          code: ERR_CODES.unknown,
          message: JSON.stringify(error, Object.getOwnPropertyNames(error))
        })
      );
    }
    let response = err;
    if (this.writer instanceof http.IncomingMessage) {
      // want to allow users to access the headers, status code etc.
      response = {
        body: err,
        ...this.writer
      };
    }
    try {
      this.pendingCalls[err.id].reject(response);
      this.cleanUp(err.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(response)}`
        );
      }
    }
  }
}
module.exports = Client;

/**
 * TCP client constructor
 * @type ClientTcp
 * @static
 */
Client.tcp = require("./tcp2");

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
