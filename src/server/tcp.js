const Server = require(".");
const _ = require("lodash");
const net = require("net");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */

class TCPServer extends Server {
  constructor(options) {
    super(options);
    this.initServer();
  }
  initServer() {
    this.server = new net.Server();
  }

  handleData() {
    this.server.on("connection", client => {
      client.on("data", data => {
        this.messageBuffer += data.trimLeft();
        const message = this.messageBuffer.split(this.options.delimiter);
        const validRequest = this.validateRequest(message);
        if (validRequest) {
          this.handleRequest(message);
        }
      });
    });
  }
}

module.exports = TCPServer;
