const Client = require(".");
const _ = require("lodash");

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
      method: "POST",
      headers: {
        "Content-Length": Buffer.byteLength(body, options.encoding),
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json"
      }
    };

    this.options = _.merge(defaults, options || {});
  }
}

module.exports = HTTPClient;
