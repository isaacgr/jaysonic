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
    this.id = 1;

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
    this.options = _.merge(defaults, options || {});
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connection = new net.Socket();
      this.client = this.connection.connect(this.server);
      this.connection.on("connect", () => {
        resolve(this.client);
      });
      this.client.on("error", error => {
        reject(error);
      });
    });
  }

  end() {
    return Promise.resolve(this.connection.end());
  }

  request(method, params, id = this.id) {
    return new Promise((resolve, reject) => {
      const clientMessage = formatRequest(method, params, id, this.options);
      return this._handleMessage(clientMessage);
    });
  }

  _handleMessage(clientMessage) {
    return new Promise((resolve, reject) => {
      this.client.write(clientMessage);
      this.client.setEncoding("utf8");
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
          ));

        ) {
          let chunk = this.messageBuffer.substring(
            this.messageBuffer,
            endPos + 1
          );
          // will throw an error if not valid json
          // this will throw for every chunk with } in it that isnt complete, but thats fine
          try {
            console.log(JSON.parse(chunk));
            const message = JSON.parse(chunk);
            // valid json, so we pull the chunk from the buffer
            this.messageBuffer = this.messageBuffer
              .substring(endPos + 1)
              .trim();
            // start new buffer
            endPos = 0;

            if (!message.id) {
              /**
               * if there is no message id in the response, then we assume its a notification
               * ignore it here and handle these separately
               */
              this.notifications[message.id] = message;
              // just start a new buffer
              endPos = 0;
            }
            if (message.id !== this.id) {
              // response was not meant for this message
              continue;
            }
            this.id += 1;
          } catch (e) {
            if (e instanceof SyntaxError) {
              // if we've reached the end of the message, and JSON is still invalid, then throw error
              if (endPos == -1) {
                reject(e);
              }
            }
          }
        }
        return () => {
          this.client.removeListener();
          resolve(this.messageBuffer);
        };
      });
      this.client.on("error", error => reject(error));
    });
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
