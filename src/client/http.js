const JsonRpcClientFactory = require(".");
const HttpClientProtocol = require("./protocol/http");
/**
 * Creates instance of HttpClientFactory
 *
 * @extends JsonRpcClientFactory
 */
class HttpClientFactory extends JsonRpcClientFactory {
  /**
   * Additional parameters ontop of those inherited from [JsonRpcClientFactory]{@link JsonRpcClientFactory}
   * @param {Object} options Connection options for the factory class
   * @param {string} [options.encoding="utf-8"] Encoding to be used for the request
   * @param {string} [options.method="POST"] Type of request to make
   * @param {object} [options.headers={"Content-Type": "application/json", Accept: "application/json"}] Request headers
   * @param {string}  [options.path="/"] URL path to make request to
   * @property {object} headers Same as `options.headers`
   * @property {string} encoding Same as `options.encoding`
   */
  constructor(options) {
    super(options);

    if (!(this instanceof HttpClientFactory)) {
      return new HttpClientFactory(options);
    }
    const defaults = {
      encoding: "utf-8",
      method: "POST",
      path: "/",
      scheme: "http"
    };

    // the Content-Length header will be calculated on a per request basis
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
    this.scheme = this.options.scheme;

    this.pcolInstance = new HttpClientProtocol(
      this,
      this.options.version,
      this.options.delimiter,
      this.options.scheme
    );
  }
}

module.exports = HttpClientFactory;
