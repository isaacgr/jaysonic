const net = require("net");
const Server = require(".");
const { formatResponse } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

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
    this.server.on("connection", (client) => {
      this.emit("clientConnected", client);
      this.connectedClients.push(client);
      client.on("data", (data) => {
        this.messageBuffer += data;
        const messages = this.messageBuffer.split(this.options.delimiter);
        this.messageBuffer = "";
        if (messages.length === 1) {
          // split didnt split
          const error = this.sendError(
            null,
            ERR_CODES.parseError,
            ERR_MSGS.parseError
          );
          client.write(JSON.stringify(error) + this.options.delimiter);

          return;
        }
        for (const chunk of messages) {
          if (chunk !== "") {
            const validRequest = () =>
              this.validateRequest(chunk)
                .then((result) => result)
                .catch((error) => {
                  throw new Error(JSON.stringify(error));
                });

            validRequest()
              .then((message) => {
                this.getResult(message.json)
                  .then((json) => {
                    client.write(json + this.options.delimiter);
                  })
                  .catch((error) => {
                    client.write(
                      JSON.stringify(error) + this.options.delimiter
                    );
                  });
              })
              .catch((error) => {
                client.write(error.message + this.options.delimiter);
              });
          }
        }
      });
      client.on("close", () => {
        this.emit("clientDisconnected", client);
      });
      client.on("end", () => {
        this.emit("clientDisconnected", client);
      });
    });
  }

  clientConnected(cb) {
    this.on("clientConnected", (client) =>
      cb({
        host: client.remoteAddress,
        port: client.remotePort
      })
    );
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

  // only available for TCP server
  notify(notification) {
    const { method, params } = notification;
    const response = formatResponse({ jsonrpc: "2.0" }, { method, params });
    try {
      this.connectedClients.forEach((client) => {
        client.write(response + this.options.delimiter);
      });
    } catch (e) {
      // was unable to send data to client, possibly disconnected
      this.emit("error", e);
    }
  }
}

module.exports = TCPServer;
