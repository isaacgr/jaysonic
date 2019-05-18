const _ = require("lodash");
const events = require("events");
const net = require("net");
const { formatRequest, parseStream } = require("../functions");
const JSONStream = require("JSONStream");

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
    this.options = _.merge(defaults, options || {});
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      this.connection = this.client.connect(this.server);
      resolve(this.connection);
      this.client.once("error", error => {
        console.log("error: " + error);
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
      this.client.write(clientMessage);
      this.client.setEncoding("utf8");
      this.client.on("data", data => {
        this.messageBuffer += data;
        resolve(data);
      });
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
