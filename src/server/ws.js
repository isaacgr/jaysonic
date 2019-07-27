const WebSocket = require("ws");
const Server = require(".");
const { formatResponse } = require("../functions");

/**
 * Constructor for Jsonic WS client
 * @class WSClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return WSClient
 */
class WSServer extends Server {
  constructor(options) {
    super(options);

    this.connectedClients = [];
    const defaults = {
      port: 8100,
      version: "2.0",
      delimiter: "\n",
      // all the ws options on the github page
      perMessageDeflate: {
        zlibDeflateOptions: {
          // See zlib defaults.
          chunkSize: 1024,
          memLevel: 7,
          level: 3
        },
        zlibInflateOptions: {
          chunkSize: 10 * 1024
        }
      }
    };

    this.options = {
      ...defaults,
      ...(options || {})
    };
  }

  listen() {
    /**
     * WS server needs to override listen method from parent
     * since the ws library starts listening on instantiation
     */
    return new Promise((resolve, reject) => {
      try {
        this.server = new WebSocket.Server(this.options);
        this.handleData();
        this.handleError();
        resolve();
      } catch (e) {
        reject(e);
      }
    });
  }

  handleData() {
    this.server.on("connection", (client) => {
      this.emit("clientConnected", client);
      this.connectedClients.push(client);
      client.on("message", (data) => {
        this.messageBuffer += data;
        const messages = this.messageBuffer.split(this.options.delimiter);
        this.messageBuffer = "";
        for (const chunk of messages) {
          if (chunk !== "") {
            Promise.all(this.handleValidation(chunk))
              .then((validationResult) => {
                const message = validationResult[1];
                if (message.batch) {
                  client.send(
                    JSON.stringify(message.batch) + this.options.delimiter
                  );
                } else if (message.notification) {
                  this.emit("notify", message.notification);
                } else {
                  this.getResult(message)
                    .then(result => client.send(result + this.options.delimiter))
                    .catch(error => client.send(
                      JSON.stringify(error) + this.options.delimiter
                    ));
                }
              })
              .catch(error => client.send(JSON.stringify(error) + this.options.delimiter));
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
    this.on("clientConnected", client => cb({
      host: client.remoteAddress,
      port: client.remotePort
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
        port: deletedClient.remotePort
      });
    });
  }

  // only available for TCP server
  notify(method, params) {
    const response = formatResponse({ jsonrpc: "2.0", method, params });
    try {
      this.connectedClients.forEach((client) => {
        client.send(response + this.options.delimiter);
      });
    } catch (e) {
      // was unable to send data to client, possibly disconnected
      this.emit("error", e);
    }
  }
}

module.exports = WSServer;
