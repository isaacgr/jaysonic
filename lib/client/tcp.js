const Client = require(".");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */

class TCPClient extends Client {
  constructor(options) {
    super(options);
    this.options = options;
  }
}

module.exports = TCPClient;
