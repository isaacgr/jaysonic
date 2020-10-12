const EventEmitter = require("events");
const { formatResponse } = require("../functions");

/**
 * Creates an instance of JsonRpcServerFactory
 * @extends events
 */
class JsonRpcServerFactory extends EventEmitter {
  /**
   * @param {object} options
   * @param {Object} [options.host] Host IP to open server with
   * @param {Object} [options.port] Host port to open server with
   * @param {Number} [options.version=2] JSON-RPC version to use (1|2)
   * @param {String} [options.delimiter="\n"] Delimiter to use for [JsonRpcServerProtocol]{@link JsonRpcServerProtocol}
   * @param {Boolean} [options.exlusive=false] disallow port sharing
   * @property {object} methods Key value pairs of server method to function call
   * @property {array} connectedClients List of connected clients
   * @property {boolean} listening  Inidicates if the server is currently listening
   * @property {class} pcolInstance Instance of [JsonRpcServerProtocol]{@link JsonRpcServerProtocol}
   */
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

  /**
   * Start listening for client connections to server.
   *
   * @returns {Promise}
   */
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

  /**
   * Set the `pcolInstance` for the server factory
   * @abstract
   */
  buildProtocol() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Set the `server` property for the server factory
   * @abstract
   */
  setServer() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Setup the `error` and `close` events for the factory and server.
   * Sets `listening` to false if any errors returned or if server stops listening.
   *
   */
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
    this.on("clientConnected", (client) => {
      this.clientConnected({
        host: client.remoteAddress,
        port: client.remotePort
      });
    });
    this.on("clientDisconnected", (client) => {
      const clientIndex = this.connectedClients.findIndex((c) => client === c);
      if (clientIndex === -1) {
        this.clientDisconnected(`Unknown client ${JSON.stringify(client)}`);
      } else {
        const [deletedClient] = this.connectedClients.splice(clientIndex, 1);
        this.clientDisconnected({
          host: deletedClient.remoteAddress,
          port: deletedClient.remotePort
        });
      }
    });
  }

  /**
   * Close the server connection. Stops listening.
   *
   * @returns {Promise}
   */
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
    if (this.connectedClients.length === 0) {
      return [Error("No clients connected")];
    }
    /**
     * Returns list of error objects if there was an error sending to any client
     * Otherwise Returns true if the entire data was sent successfully
     * Returns false if all or part of the data was not
     */
    return this.connectedClients.map((client) => {
      try {
        return this.sendNotification(client, response);
      } catch (e) {
        console.log("here");
        // possibly client disconnected
        return e;
      }
    });
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

  clientConnected(event) {
    return event;
  }

  clientDisconnected(event) {
    return event;
  }
}

module.exports = JsonRpcServerFactory;

/**
 * HTTP server constructor
 * @type HttpServerFactory
 * @static
 */
JsonRpcServerFactory.http = require("./http");

/**
 * TCP server constructor
 * @type TcpServerFactory
 * @static
 */
JsonRpcServerFactory.tcp = require("./tcp");

/**
 * WS server constructor
 * @type WsServerFactory
 * @static
 */
JsonRpcServerFactory.ws = require("./ws");
