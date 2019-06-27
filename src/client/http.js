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
      host: this.server.host,
      port: this.server.port || 80,
      method: "POST",
      headers: {
        // "Content-Length": Buffer.byteLength(
        //   this.messageBuffer,
        //   this.options.encoding
        // ),
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json"
      },
      path: "/"
    };
    this.messageBuffer = "";
    this.options = _.merge(defaults, this.options || {});
    this.initClient();
  }

  initClient() {
    this.client = http.request(this.options, (response) => {
      this.writer = response;
      this.listen();
      this.handleResponse();
      this.handleError();
    });
  }

  request() {
    return {
      message: (method, params) => {
        const request = formatRequest(
          method,
          params,
          this.message_id,
          this.options
        );
        this.message_id += 1;
        return request;
      },

      send: (method, params) =>
        new Promise((resolve, reject) => {
          const requestId = this.message_id;
          this.pendingCalls[requestId] = { resolve, reject };
          this.client.write(this.request().message(method, params));
          this.client.end();
          setTimeout(() => {
            if (this.pendingCalls[requestId]) {
              const error = this.sendError({
                id: requestId,
                code: ERR_CODES["timeout"],
                message: ERR_MSGS["timeout"]
              });
              delete this.pendingCalls[requestId];
              this.client.end();
              reject(error);
            }
          }, this.options.timeout);
        })
    };
  }
}

module.exports = HTTPClient;
