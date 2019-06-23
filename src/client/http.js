const _ = require("lodash");
const http = require("http");
const Client = require(".");
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
          this.options.encoding,
        ),
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
      },
      path: "/",
    };

    this.messageBuffer = "";

    this.options = _.merge(defaults, options || {});
  }

  request(method, params) {
    const requestPromise = new Promise((resolve, reject) => {
      const clientMessage = formatRequest(
        method,
        params,
        this.message_id,
        this.options,
      );
      const reqOptions = {
        hostname: this.server.host,
        port: 80 || this.server.port,
        path: this.options.path,
        method: this.options.method,
        headers: this.options.headers,
      };
      const options = _.merge(reqOptions, this.options || {});

      this.pendingCalls[this.message_id] = { resolve, reject };
      this.message_id += 1;
      const req = this.httpRequest(options);
      req.write(clientMessage);
      req.end();
    });

    return requestPromise;
  }

  httpRequest(options) {
    return http.request(options, (res) => {
      res.on("data", (data) => {
        this.messageBuffer += data;
        this.verifyData();
      });
      res.on("end", () => {

      });
    });
  }
}

module.exports = HTTPClient;
