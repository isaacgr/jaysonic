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
          const messages = this.messageBuffer.split(this.options.delimiter);
          this.messageBuffer = "";
          messages
            .filter(messageString => messageString !== "")
            .map(chunk => Promise.all(this.handleValidation(chunk))
              .then((validationResult) => {
                const message = validationResult[1];
                if (message.batch) {
                  this.setResponseHeader({ response });
                  response.write(
                    JSON.stringify(message.batch) + this.options.delimiter,
                    () => {
                      response.end();
                    }
                  );
                } else if (message.notification) {
                  this.setResponseHeader({ response, notification: true });
                  response.end();
                } else {
                  this.getResult(message)
                    .then((result) => {
                      this.setResponseHeader({ response });
                      response.write(result + this.options.delimiter, () => {
                        response.end();
                      });
                    })
                    .catch((error) => {
                      this.setResponseHeader({
                        response,
                        errorCode: error.error.code
                      });
                      response.write(
                        JSON.stringify(error) + this.options.delimiter,
                        () => {
                          response.end();
                        }
                      );
                    });
                }
              })
              .catch((error) => {
                this.setResponseHeader({
                  response,
                  errorCode: error.code
                });
                response.write(
                  JSON.stringify(error) + this.options.delimiter,
                  () => {
                    response.end();
                  }
                );
              }));
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

  setResponseHeader({ response, errorCode, notification }) {
    let statusCode = 200;
    if (notification) {
      statusCode = 204;
    }
    const header = {
      "Content-Type": "application/json"
    };
    if (errorCode) {
      statusCode = errorToStatus[String(errorCode)];
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
