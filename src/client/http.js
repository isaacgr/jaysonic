const _ = require("lodash");
const http = require("http");
const Client = require(".");

/**
 * Constructor for Jsonic HTTP client
 * @class HTTPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return HTTPClient
 */

class HTTPClient extends Client {
  constructor(server, options) {
    super(server, options);
    const defaults = {
      hostname: this.server.host,
      port: this.server.port || 80,
      method: "POST",
      headers: {
        "Content-Length": Buffer.byteLength(
          this.messageBuffer,
          this.options.encoding
        ),
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json"
      },
      path: "/"
    };

    this.messageBuffer = "";
    this.options = _.merge(defaults, options || {});
  }
}

module.exports = HTTPClient;
