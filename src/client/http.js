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
   * @property {object} headers Same as <code>options.headers</code>
   * @property {string} encoding Same as <code>options.encoding</code>
   */
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
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      path: "/"
    };
    this.options = {
      ...defaults,
      ...(this.options || {})
    };
    this.headers = this.options.headers;
    this.encoding = this.options.encoding;

    this.pcolInstance = new HttpClientProtocol(
      this,
      this.options.version,
      this.options.delimiter
    );
  }
}

module.exports = HttpClientFactory;
