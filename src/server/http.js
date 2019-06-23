const http = require("http");
const Server = require(".");

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
        request
          .on("data", (data) => {
            this.messageBuffer += data;
          })
          .on("end", () => {
            const message = this.messageBuffer.split(this.options.delimiter)[0];
            this.messageBuffer = "";
            response.writeHead(200, { "Content-Type": "application/json" });
            this.validateRequest(message)
              .then(() => {
                this.getResult(message).then((result) => {
                  response.write(result, () => {
                    response.end();
                  });
                });
              })
              .catch((error) => {
                response.write(JSON.stringify(error), () => {
                  response.end();
                });
              });
          });
        client.on("end", () => {
          this.emit("clientDisconnected");
        });
      });
    });
  }

  clientConnected(cb) {
    this.on("clientConnected", client => cb({
      host: client.remoteAddress,
      port: client.remotePort,
    }));
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
        port: deletedClient.remotePort,
      });
    });
  }
}

module.exports = HTTPServer;
