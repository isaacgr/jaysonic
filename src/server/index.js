const EventEmitter = require("events");
const { formatResponse } = require("../functions");

/**
 * @class JsonRpcServerFactory
 * @extends require('events').EventEmitter
 * @param {Object} [host] host IP to connect with
 * @param {Object} [host] host port to connect with
 * @param {Object} [options]
 * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
 * @param {String} [options.delimiter="\n"] delimiter to use for requests
 * @param {Boolean} [options.exlusive=false] disallow port sharing
 * @return {Client}
 */
class JsonRpcServerFactory extends EventEmitter {
  constructor(options) {
    super();
    if (!(this instanceof JsonRpcServerFactory)) {
      return new JsonRpcServerFactory(options);
    }

    const defaults = {
      host: "127.0.0.1",
      port: 8100,
      exclusive: false,
      version: "2.0",
      delimiter: "\n"
    };

    this.options = {
      ...defaults,
      ...(options || {})
    };

    this.methods = {};
    this.connectedClients = [];
    this.listening = false;
    this.pcolInstance = undefined;
  }

  listen() {
    return new Promise((resolve, reject) => {
      if (this.listening) {
        // not having this caused MaxEventListeners error
        return reject(Error("server already listening"));
      }
      const { host, port, exclusive } = this.options;
      this.setServer();
      this.server.listen({ host, port, exclusive });
      this.server.on("listening", () => {
        this.listening = true;
        this.buildProtocol();
        resolve({
          host: this.server.address().address,
          port: this.server.address().port
        });
      });
      this.setupListeners();
    });
  }

  buildProtocol() {
    throw new Error("function must be overwritten in subclass");
  }

  setupListeners() {
    this.on("error", (error) => {
      this.listening = false;
      throw error;
    });
    this.server.on("error", (error) => {
      this.listening = false;
      throw error;
    });
    this.server.on("close", () => {
      this.listening = false;
    });
  }

  close() {
    this.listening = false;
    return new Promise((resolve, reject) => {
      this.server.close((error) => {
        if (error) {
          reject(error);
        }
        resolve();
      });
    });
  }

  // add the method and its associated callback to the object
  method(name, cb) {
    this.methods[name] = cb;
  }

  onNotify(method, cb) {
    this.on(method, cb);
  }

  removeOnNotify(method, cb) {
    this.removeListener(method, cb);
  }

  removeAllOnNotify(method) {
    this.removeAllListeners([method]);
  }

  notify(notifications) {
    if (notifications.length === 0 || !Array.isArray(notifications)) {
      throw new Error("Invalid arguments");
    }
    const responses = this._getNotificationResponses(notifications);
    if (responses.length === 0) {
      throw new Error("Unable to generate a response object");
    }
    let response;
    if (responses.length === 1) {
      response = formatResponse(responses[0]);
    } else {
      // batch notification responses
      response = "[";
      responses.forEach((res, idx) => {
        response += formatResponse(res);
        response += idx === responses.length - 1 ? "" : ",";
      });
      response += "]";
    }
    return this.sendNotifications(response);
  }

  _getNotificationResponses(notifications) {
    return notifications.map(([method, params]) => {
      if (!method && !params) {
        throw new Error("Unable to generate a response object");
      }
      const response = {
        method,
        params,
        delimiter: this.options.delimiter
      };
      if (this.options.version === "2.0") {
        response.jsonrpc = "2.0";
      }
      return response;
    });
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
        return cb(`Unknown client ${JSON.stringify(client)}`);
      }
      const [deletedClient] = this.connectedClients.splice(clientIndex, 1);
      return cb({
        host: deletedClient.remoteAddress,
        port: deletedClient.remotePort
      });
    });
  }
}

module.exports = JsonRpcServerFactory;

/**
 * HTTP server constructor
 * @type ServerHTTP
 * @static
 */
JsonRpcServerFactory.http = require("./http");

/**
 * TCP server constructor
 * @type ServerTCP
 * @static
 */
JsonRpcServerFactory.tcp = require("./tcp");

/**
 * WS server constructor
 * @type ServerWS
 * @static
 */
JsonRpcServerFactory.ws = require("./ws");
