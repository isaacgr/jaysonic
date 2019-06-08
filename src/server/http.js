const Server = require(".");
const _ = require("lodash");
const http = require("http");

/**
 * Constructor for Jsonic HTTP client
 * @class HTTPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return HTTPClient
 */

class HTTPServer extends Server {
  constructor(options) {
    super(options);

    this.messageBuffer = "";

    this.initserver();
  }
  initserver() {
    this.server = new http.Server();
  }

  handleData() {
    this.server.on("connection", client => {
      // got a client connection, do something with the data
      this.server.on("request", (request, response) => {
        request
          .on("data", data => {
            this.messageBuffer += data;
          })
          .on("end", () => {
            const message = this.messageBuffer.split(this.options.delimiter)[0];
            const validRequest = this.validateRequest(message);
            if (validRequest) {
              this.messageBuffer = "";
              response.writeHead(200, { "Content-Type": "application/json" });
              const result = this.getResult(message);
              response.write(result);
              response.end();
            }
          });
        client.on("end", () => {
          console.warn("Other side closed connection");
        });
      });
    });
  }
}

module.exports = HTTPServer;
