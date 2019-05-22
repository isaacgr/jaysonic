const _ = require("lodash");
const events = require("events");
const net = require("net");
const { formatRequest, parseStream } = require("../functions");

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

ERR_PARSE_ERROR = -32700;
ERR_INVALID_REQUEST = -32600;
ERR_METHOD_NOT_FOUND = -32601;
ERR_INVALID_PARAMS = -32602;
ERR_INTERNAL = -32603;

ERR_MSGS = {
  ERR_PARSE_ERROR: "Parse Error",
  ERR_INVALID_REQUEST: "Invalid Request",
  ERR_METHOD_NOT_FOUND: "Method not found",
  ERR_INVALID_PARAMS: "Invalid parameters"
};

class Client {
  constructor(server, options) {
    if (!(this instanceof Client)) {
      return new Client(options);
    }

    const defaults = {
      version: 2,
      delimiter: "\r\n",
      persist: true
    };

    this.server = server;
    this.message_id = 1;
    this.serving_message_id = 1;

    /**
     * we get the message in either chunks or as a whole, so it gets buffered
     *
     * whole message:
     * {"jsonrpc": "2.0", "result": -19, "id": 1}
     *
     * chunk:
     * {"jsonrpc": "2.0",
     *
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
        this._listen();
        resolve();
      });
      this.client.on("error", error => {
        reject(error);
      });
    });
  }

  end() {
    return Promise.resolve(this.connection.end());
  }

  request(method, params, id = this.message_id) {
    this.message_id = id;
    return new Promise((resolve, reject) => {
      const clientMessage = formatRequest(
        method,
        params,
        this.message_id,
        this.options
      );
      this.client.write(clientMessage);
      this.on("response", id => {
        if (Object.keys(this.responseQueue[id]).indexOf(this.message_id)) {
          this.message_id += 1;
          resolve(this.responseQueue[id]);
        }
      });
      this.on("error", error => reject(error));
    });
  }

  subscribe(method) {
    return new Promise((resolve, reject) => {
      this.on("notify", notifyMethod => {
        method === notifyMethod && resolve(this.notifications[method]);
      });
      this.on("error", error => reject(error));
    });
  }

  _listen() {
    this.client.on("data", data => {
      this.messageBuffer += data;
      /**
       * want to search for whole messages by matching the delimiter from the start of the buffer
       */
      for (
        let endPos;
        (endPos = this.messageBuffer.indexOf(
          this.options.delimiter,
          endPos + 1
        )) !== -1;

      ) {
        let chunk = this.messageBuffer.substring(
          this.messageBuffer,
          endPos + 1
        );
        // will throw an error if not valid json
        try {
          const message = JSON.parse(chunk);
          // valid json, so we pull the chunk from the buffer
          this.messageBuffer = this.messageBuffer.substring(endPos + 1).trim();
          // start new buffer
          endPos = 0;

          if (!message.id) {
            //if there is no message id in the response, then we assume its a notification
            try {
              var method = message.method.replace(".", "_");
            } catch (e) {
              if (e instanceof TypeError) {
                this.send_error(this.message_id, ERR_INVALID_PARAMS);
              }
            }
            this.notifications[method] = message;
            this.emit("notify", method);
            // just start a new buffer
            endPos = 0;
          }
          this.serving_message_id = message.id;
          this.responseQueue[this.serving_message_id] = message;
          this.emit("response", this.serving_message_id);
        } catch (e) {
          if (e instanceof SyntaxError) {
            // if we've reached the end of the message, and JSON is still invalid, then throw error
            if (endPos === -1) {
              this.send_error(this.message_id, ERR_PARSE_ERROR);
            }
          }
        }
      }
    });
  }

  send_error(id, code, message = null) {
    if (!message) {
      message = ERR_MSGS[message] || "Unknown Error";
    }
    response = { error: { code: code, message: message }, id: id };
    this.emit("error");
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
