const _ = require("lodash");
const events = require("events");
const net = require("net");

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
    this.options = _.merge(defaults, options || {});
  }

  async connect() {
    this.client = new net.Socket();
    this.connection = this.client.connect(this.server);
    return await this.connection;
  }

  async end() {
    return await this.connection.end();
  }

  async request(method, params) {
    return await this.client.on("data", data => data);
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
