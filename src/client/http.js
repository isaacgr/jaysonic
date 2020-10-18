const JsonRpcClientFactory = require(".");
const HttpClientProtocol = require("./protocol/http");
/**
 * Constructor for Jsonic HTTP client
 * @class HttpClientFactory
 * @constructor
 * @extends JsonRpcClientFactory
 * @param {Object} [options] optional settings for client
 * @return HttpClientFactory
 */
class HttpClientFactory extends JsonRpcClientFactory {
  constructor(options) {
    super(options);

    if (!(this instanceof HttpClientFactory)) {
      return new HttpClientFactory(options);
    }
    // the content length will be calculated on a per request basis
    // according to the node http docs:
    // the encoding argument is optional and only applies when chunk is a string.
    // Defaults to 'utf8'.
    const defaults = {
      encoding: "utf-8",
      method: "POST",
      path: "/",
      type: "http"
    };
    this.options = {
      ...defaults,
      ...(this.options || {}),
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...this.options.headers
      }
    };
    this.headers = this.options.headers;
    this.encoding = this.options.encoding;
    this.type = this.options.type;

    this.pcolInstance = new HttpClientProtocol(
      this,
      this.options.version,
      this.options.delimiter,
      this.options.type
    );
  }
}

module.exports = HttpClientFactory;
