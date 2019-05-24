const Client = require(".");
const _ = require("lodash");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */

class TCPClient extends Client {
  constructor(server, options) {
    super(server, options);
  }
}

module.exports = TCPClient;
