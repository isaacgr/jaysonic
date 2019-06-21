const Server = require(".");
const _ = require("lodash");
const net = require("net");
const { formatResponse } = require("../functions");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */

class TCPServer extends Server {
  constructor(options) {
    super(options);

    this.connectedClients = [];

    this.initServer();
  }
  initServer() {
    this.server = new net.Server();
  }

  handleData() {
    this.server.on("connection", client => {
      this.connectedClients.push(client);
      client.on("data", data => {
        this.messageBuffer += data;
        const messages = this.messageBuffer.split(this.options.delimiter);
        for (let chunk of messages) {
          if (chunk === "") {
            continue;
          }
          const validRequest = () =>
            this.validateRequest(chunk)
              .then(result => {
                return result;
              })
              .catch(error => {
                throw new Error(JSON.stringify(error));
              });

          validRequest()
            .then(result => {
              this.getResult(result.json)
                .then(result => {
                  client.write(result + this.options.delimiter);
                  client.pipe(client);
                })
                .catch(error => {
                  client.write(JSON.stringify(error) + this.options.delimiter);
                  client.pipe(client);
                });
            })
            .catch(error => {
              client.write(error["message"] + this.options.delimiter);
              client.pipe(client);
            });
        }
      });
      client.on("close", () => {
        this.clientDisconnected(client);
      });
    });
  }

  clientDisconnected(client) {
    // return disconnected client object
    const clientIndex = this.connectedClients.findIndex(c => {
      return client === c;
    });
    if (clientIndex === -1) {
      return "unknown";
    }
    const [deletedClient] = this.connectedClients.splice(clientIndex, 1);
    return deletedClient;
  }
  // only available for TCP server
  // notifications have no id
  notify(notification) {
    const { method, params } = notification;
    const response = formatResponse({ jsonrpc: "2.0" }, { method, params });
    this.connectedClients.forEach(client => {
      client.write(response + this.options.delimiter);
      client.pipe(client);
    });
  }
}

module.exports = TCPServer;
