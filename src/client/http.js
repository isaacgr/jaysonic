const Client = require(".");
const _ = require("lodash");
const http = require("http");
const { formatRequest } = require("../functions");

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

  request(method, params) {
    const req_promise = new Promise((resolve, reject) => {
      const clientMessage = formatRequest(
        method,
        params,
        this.message_id,
        this.options
      );
      const reqOptions = {
        hostname: this.server.host,
        port: 80 || this.server.port,
        path: this.options.path,
        method: this.options.method,
        headers: this.options.headers
      };
      const options = _.merge(reqOptions, this.options || {});

      this.pendingCalls[this.message_id] = { resolve, reject };
      this.message_id += 1;
      const req = this._http_request(options);
      req.write(clientMessage);
      req.end();
    });

    return req_promise;
  }

  _http_request(options) {
    return http.request(options, res => {
      res.on("data", data => {
        this.messageBuffer += data;
        this._verifyData();
      });
      res.on("end", () => {
        console.log("end");
      });
    });
  }
}

module.exports = HTTPClient;
