const EventEmitter = require("events");
const { formatResponse } = require("../util/format");
const JsonRpcServerProtocol = require("./protocol/base");

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
   * @property {array} clients List of client connections which are instances of [JsonRpcServerProtocol]{@link JsonRpcServerProtocol}
   * @property {boolean} listening  Inidicates if the server is currently listening
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
      version: 2,
      delimiter: "\n"
    };

    this.options = {
      ...defaults,
      ...(options || {})
    };

    this.methods = {};
    this.clients = [];
    this.listening = false;
    this.protocol = JsonRpcServerProtocol;
  }

  /**
   * Start listening for client connections to server.
   *
   * Calls [setServer]{@link JsonRpcServerFactory#setServer} and [buildProtocol]{@link JsonRpcServerFactory#buildProtocol}.
   *
   * Establishes `error` and `close` listeners.
   *
   * @returns {Promise} Resolves host and port address for server.
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
      this._setupListeners(reject);
      this.server.on("listening", () => {
        this.listening = true;
        this.buildProtocol();
        resolve({
          host: this.server.address().address,
          port: this.server.address().port
        });
      });
    });
  }

  /**
   * Establishes the client connection using the protocol instance
   * and adds the newly connected client to `this.clients`.
   *
   * Registers the event to call `clientDisconnected` when a client a closes the connection
   *
   * @abstract
   * @example
   * const pcol = JsonRpcServerProtocol()
   * pcol.clientConnected()
   * this.clients.push(pcol)
   */
  buildProtocol() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Set the `server` property for the server factory
   * @abstract
   * @example
   * this.server = new net.Server()
   */
  setServer() {
    throw new Error("function must be overwritten in subclass");
  }

  /**
   * Setup the `error` and `close` events for the factory and server.
   *
   * Calls [JsonRpcServerFactory]{@link JsonRpcServerFactory#_removeClients} when server closes
   * and sets `listening` to false
   *
   * @param {function} cb Callback to invoke if server receives an `error` event
   * @private
   */
  _setupListeners(cb) {
    this.server.on("error", cb);
    this.server.on("close", () => {
      this.listening = false;
      this._removeClients();
    });
  }

  /**
   * Closes the server connection and kicks all connected clients.
   *
   * Sets `listening` property to `false`.
   *
   * @returns {Promise} Will reject if any error was present
   */
  close() {
    this.listening = false;
    return new Promise((resolve, reject) => {
      this._removeClients();
      this.server.close((error) => {
        if (error) {
          reject(error);
        }
        resolve();
      });
    });
  }

  /**
   * Kicks all connected clients.
   *
   * Removes all entries from `this.clients`
   *
   * @private
   */
  _removeClients() {
    for (const pcol of this.clients) {
      pcol.client.destroy();
    }
    this.clients = [];
  }

  /**
   * Register a method and associated function with the server.
   *
   * The function will be called when a client makes a request to this method.
   *
   * @param {string} name Name of method
   * @param {function} cb Function to call when client makes request to method
   */
  method(name, cb) {
    this.methods[name] = cb;
  }

  /**
   * Call function when notification with event name comes in.
   *
   * @param {string} method Method name to listen for notification
   * @param {function} cb Name of callback function fired when method event comes in
   *
   * @example
   * function world(){
   *  return 'foo'
   * }
   * server.onNotify("hello", world)
   */
  onNotify(method, cb) {
    this.on(method, cb);
  }

  /**
   * Remove function name from listening for notifications.
   *
   * @param {string} method Method name to remove
   * @param {function} cb Name of the callback function to remove
   *
   * @example
   * function world(){
   *  return 'foo'
   * }
   * server.removeOnNotify("hello", world)
   */
  removeOnNotify(method, cb) {
    this.removeListener(method, cb);
  }

  /**
   * Remove all functions listening for notification.
   *
   * @param {string} method Method name to remove events for
   */
  removeAllOnNotify(method) {
    this.removeAllListeners(method);
  }

  /**
   * @param {Array.<Array.<string, Array|object>>} notifications Array of notifications
   * @returns {boolean[]|Error[]} Returns list of error objects if there was an error sending to any client.
   * Returns true if the entire data was sent successfully
   * Returns false if all or part of the data was not sent to the client.
   *
   * @example
   * server.notify([
   *    ["hello", ["world"]],
   *    ["foo", {"bar": "baz"}]
   * ])
   */
  notify(notifications) {
    if (notifications.length === 0 || !Array.isArray(notifications)) {
      throw new Error("Invalid arguments");
    }
    const responses = this._getNotificationResponses(notifications);
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
      response = JSON.stringify(JSON.parse(response)) + this.options.delimiter;
    }
    if (this.clients.length === 0) {
      return [Error("No clients connected")];
    }
    return this.clients.map((pcol) => {
      try {
        return this.sendNotification(pcol.client, response);
      } catch (e) {
        // possibly client disconnected
        return e;
      }
    });
  }

  /**
   * Send notification to client
   *
   * @param {class} client Client instance
   * @param {string} response Stringified JSON-RPC message to sent to client
   * @throws Will throw an error if client is not defined
   */
  sendNotification(client, response) {
    return client.write(response);
  }

  /**
   * Generate objects for notifications to send to client
   *
   * @param {Array.<string, Array>} notifications Array of notifications to send to client.
   * @returns {JSON} Returns a valid JSON-RPC response object
   * @private
   */
  _getNotificationResponses(notifications) {
    return notifications.map(([method, params]) => {
      if ((!method && !params) || (!method && params)) {
        throw new Error("Unable to generate a response object");
      }
      const response = {
        method,
        params,
        delimiter: this.options.delimiter
      };
      if (this.options.version === 2) {
        response.jsonrpc = "2.0";
      }
      return response;
    });
  }

  /**
   * Called when client receives a `connection` event.
   *
   * @param {JsonRpcServerProtocol} pcol A {@link JsonRpcServerProtocol} instance
   * @returns {JsonRpcServerProtocol.client} Returns a client for a given `JsonRpcServerProtocol` instance
   */
  clientConnected(pcol) {
    return pcol.client;
  }

  /**
   * Called when client disconnects from server.
   *
   * If overwriting, its recommended to call {@link JsonRpcServerFactory.removeDisconnectedClient} manually
   * to ensure `this.clients` is cleaned up
   *
   * @param {JsonRpcServerProtocol} pcol A {@link JsonRpcServerProtocol} instance
   * @returns {object|error} Returns an object of {host, port} for the given protocol instance, or {error}
   * if there was an error retrieving the client
   */
  clientDisconnected(pcol) {
    return this.removeDisconnectedClient(pcol);
  }

  /**
   * Removes disconnected client from `this.clients` list
   *
   * @param {JsonRpcServerProtocol} pcol A {@link JsonRpcServerProtocol} instance
   * @returns {object|error} Returns an object of {host, port} for the given protocol instance, or {error}
   *
   */
  removeDisconnectedClient(pcol) {
    const clientIndex = this.clients.findIndex(p => p === pcol);
    if (clientIndex === -1) {
      return {
        error: `Unknown client ${JSON.stringify(pcol)}`
      };
    }
    const [protocol] = this.clients.splice(clientIndex, 1);
    return protocol.client;
  }

  /**
   * Returns a list of all server class methods which start with 'handle'.
   *
   * @param {object} toCheck The object get prototype function names from
   * @private
   */
  _getAllFuncs(toCheck) {
    return Object.getOwnPropertyNames(Object.getPrototypeOf(toCheck)).filter(
      (e, i, arr) => {
        if (
          e !== arr[i + 1]
          && typeof toCheck[e] === "function"
          && e.startsWith("handle")
        ) {
          return true;
        }
        return false;
      }
    );
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
