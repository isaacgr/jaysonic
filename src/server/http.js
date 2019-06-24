const http = require("http");
const Server = require(".");
const { ERR_CODES, ERR_MSGS, errorToStatus } = require("../constants");

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
          const message = this.messageBuffer;
          this.messageBuffer = "";
          // if (messages.length === 1) {
          //   // split didnt split
          //   const error = this.sendError(
          //     null,
          //     ERR_CODES.parseError,
          //     ERR_MSGS.parseError
          //   );
          //   this.setResponseHeader(response, error.error.code);
          //   response.write(
          //     JSON.stringify(error) + this.options.delimiter,
          //     () => {
          //       response.end(this.options.delimiter, () => {
          //         request.destroy();
          //       });
          //     }
          //   );
          // } else {

          // }
          // for (let message of messages) {

          // }
          this.validateRequest(message)
            .then((message) => {
              this.getResult(message.json)
                .then((result) => {
                  response.write(result + this.options.delimiter, () => {
                    response.end();
                  });
                })
                .catch((error) => {
                  this.setResponseHeader(response, error.error.code);
                  response.write(
                    JSON.stringify(error) + this.options.delimiter,
                    () => {
                      response.end();
                    }
                  );
                });
            })
            .catch((error) => {
              this.setResponseHeader(response, error.error.code);
              response.write(
                JSON.stringify(error) + this.options.delimiter,
                () => {
                  response.end();
                }
              );
            });
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
      const clientIndex = this.connectedClients.findIndex((c) => client === c);
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
