const http = require("http");
const Server = require(".");
const { errorToStatus } = require("../constants");

/**
 * Constructor for Jsonic HTTP server
 * @class HTTPServer
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for server
 * @return HTTPServer
 */

class HTTPServer extends Server {
  constructor(options) {
    super(options);

    this.connectedClients = [];
    this.responseBuffer = [];
    this.initserver();
  }

  initserver() {
    this.server = new http.Server();
  }

  handleData() {
    this.server.on("connection", (client) => {
      this.connectedClients.push(client);
      this.server.on("request", (request, response) => {
        request.on("data", (data) => {
          this.messageBuffer += data;
        });
        request.on("end", () => {
          /**
           * HTTP messages could contain delimited requests
           * or be batched.
           *
           * Delimited requests should be resolved, and then sent back
           * as a delimited response
           *
           * Batched requests get handled individually, results wrapped in a list
           * and then sent back to client
           */
          const messages = this.messageBuffer.split(this.options.delimiter);
          this.messageBuffer = "";
          if (messages.length > 1) {
            // delimited request
            const promises = messages
              .filter(messageString => messageString !== "")
              .map(message => this.validateRequest(message)
                .then(({ json }) => this.getResult(json)
                  .then((result) => {
                    this.setResponseHeader(response);
                    return result;
                  })
                  .catch((error) => {
                    this.setResponseHeader(response, error.error.code);
                    return JSON.stringify(error);
                  }))
                .catch((error) => {
                  this.setResponseHeader(response, error.error.code);
                  return JSON.stringify(error);
                }));
            Promise.all(promises)
              .then((result) => {
                const res = result.join(this.options.delimiter);
                response.write(res, () => {
                  response.end();
                });
              })
              .catch((error) => {
                const res = error.join(this.options.delimiter);
                response.write(res, () => {
                  response.end();
                });
              });
          } else {
            // possibly a batch request, check and resolve if so
            // reject otherwise
            this.handleBatchRequest(messages)
              .then((responses) => {
                const res = JSON.stringify(responses);
                response.write(res, () => {
                  response.end();
                });
              })
              .catch((error) => {
                const res = JSON.stringify(error);
                response.write(res, () => {
                  response.end();
                });
              });
          }
        });
      });
      client.on("close", () => {
        this.server.removeAllListeners("request");
        this.emit("clientDisconnected");
      });
      client.on("end", () => {
        this.server.removeAllListeners("request");
        this.emit("clientDisconnected");
      });
    });
  }

  setResponseHeader(response, error = undefined) {
    let statusCode = 200;
    const header = {
      "Content-Type": "application/json"
    };
    if (error) {
      statusCode = errorToStatus[String(error)];
    }
    response.writeHead(statusCode, header);
  }

  clientConnected(cb) {
    this.on("clientConnected", (client) => {
      cb({
        host: client.remoteAddress,
        port: client.remotePort
      });
    });
  }

  clientDisconnected(cb) {
    this.on("clientDisconnected", (client) => {
      const clientIndex = this.connectedClients.findIndex(c => client === c);
      if (clientIndex === -1) {
        return "unknown";
      }
      const [deletedClient] = this.connectedClients.splice(clientIndex, 1);
      return cb({
        host: deletedClient.remoteAddress,
        port: deletedClient.remotePort
      });
    });
  }
}

module.exports = HTTPServer;
