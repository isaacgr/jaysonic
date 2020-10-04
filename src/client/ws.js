const WebSocket = require("ws");
const Client = require(".");
const { formatRequest, formatError } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

class WSClient extends Client {
  constructor(options) {
    super(options);

    if (!(this instanceof WSClient)) {
      return new WSClient(options);
    }

    const defaults = {
      url: "ws://127.0.0.1:8100",
      version: "2.0",
      delimiter: "\n",
      timeout: 30,
      connectionTimeout: 5000,
      retries: 2
    };

    this.options = {
      ...defaults,
      ...(options || {})
    };
  }

  initialize() {
    const { url, perMessageDeflate } = this.options;
    this.client = new WebSocket(url, perMessageDeflate);
    this.client.onopen = (event) => {
      this.connected = true;
      this.listen();
      this.connectionHandler.resolve(event);
    };
    this.client.onerror = (error) => {
      this.connected = false;
      // let the onclose event handle it otherwise
      if (error.error.code !== "ECONNREFUSED") {
        this.connectionHandler.reject(error);
      }
    };
    this.client.onclose = () => {
      this.connected = false;
      if (this.client.__clientClosed) {
        console.log("Connection closed.");
      } else if (this.remainingRetries) {
        this.remainingRetries -= 1;
        console.error(
          `Connection failed. ${this.remainingRetries} attempts left.`
        );
        setTimeout(() => {
          this.initialize();
        }, this.options.connectionTimeout);
      } else {
        this.connectionHandler.reject({
          error: {
            code: "ECONNREFUSED",
            message: `connection refused ${this.options.url}`
          }
        });
      }
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.connectionHandler = { resolve, reject };
      this.initialize();
    });
  }

  end(code, reason) {
    this.client.__clientClosed = true;
    this.client.close(code, reason);
  }

  listen() {
    this.client.onmessage = (message) => {
      this.handleData(message.data);
    };
  }

  request() {
    return {
      message: (method, params, id = true) => {
        const request = formatRequest({
          method,
          params,
          id: id ? this.message_id : undefined,
          options: this.options
        });
        if (id) {
          this.message_id += 1;
        }
        return request;
      },
      send: (method, params) => new Promise((resolve, reject) => {
        const requestId = this.message_id;
        this.pendingCalls[requestId] = { resolve, reject };
        try {
          this.client.send(this.request().message(method, params));
        } catch (e) {
          reject(e);
        }
        this.timeouts[requestId] = setTimeout(() => {
          this.cleanUp(requestId);
          try {
            const error = JSON.parse(
              formatError({
                jsonrpc: this.options.version,
                delimiter: this.options.delimiter,
                id: null,
                code: ERR_CODES.timeout,
                message: ERR_MSGS.timeout
              })
            );
            this.pendingCalls[requestId].reject(error);
            delete this.pendingCalls[requestId];
          } catch (e) {
            if (e instanceof TypeError) {
              console.error(
                `Message has no outstanding calls: ${JSON.stringify(e)}`
              );
            }
          }
        }, this.options.timeout);
      }),
      notify: (method, params) => {
        const request = formatRequest({
          method,
          params,
          options: this.options
        });
        return new Promise((resolve, reject) => {
          try {
            this.client.send(request);
            resolve(request);
            this.client.onerror = (error) => {
              reject(error);
            };
          } catch (e) {
            reject(e);
          }
        });
      }
    };
  }

  batch(requests) {
    /**
     * should receive a list of request objects
     * [client.request.message(), client.request.message()]
     * send a single request with that, server should handle it
     *
     * We want to store the IDs for the requests in the batch in an array
     * Use this to reference the batch response
     * The spec has no explaination on how to do that, so this is the solution
     */

    return new Promise((resolve, reject) => {
      const batchIds = [];
      const batchRequests = [];
      for (const request of requests) {
        const json = JSON.parse(request);
        batchRequests.push(json);
        if (json.id) {
          batchIds.push(json.id);
        }
      }
      this.pendingBatches[String(batchIds)] = { resolve, reject };
      const request = JSON.stringify(batchRequests);
      try {
        this.client.send(request + this.options.delimiter);
      } catch (e) {
        // this.client is probably undefined
        reject(e.message);
      }
      this.timeouts[String(batchIds)] = setTimeout(() => {
        // remove listener
        this.cleanUp(String(batchIds));
        try {
          const error = JSON.parse(
            formatError({
              jsonrpc: this.options.version,
              delimiter: this.options.delimiter,
              id: null,
              code: ERR_CODES.timeout,
              message: ERR_MSGS.timeout
            })
          );
          this.pendingBatches[String(batchIds)].reject(error);
          delete this.pendingBatches[String(batchIds)];
        } catch (e) {
          if (e instanceof TypeError) {
            console.error(
              `Message has no outstanding calls: ${JSON.stringify(e)}`
            );
          }
        }
      }, this.options.timeout);
      this.listeners[String(batchIds)] = this.gotBatchResponse;
      this.on("batchResponse", this.listeners[String(batchIds)]);
    });
  }

  gotBatchResponse(batch) {
    const batchResponseIds = [];
    batch.forEach((message) => {
      if (message.id) {
        batchResponseIds.push(message.id);
      }
    });
    if (batchResponseIds.length === 0) {
      // dont do anything here since its basically an invalid response
    }

    for (const ids of Object.keys(this.pendingBatches)) {
      const arrays = [JSON.parse(`[${ids}]`), batchResponseIds];
      const difference = arrays.reduce((a, b) => a.filter(c => !b.includes(c)));
      if (difference.length === 0) {
        this.cleanUp(ids);
        batch.forEach((message) => {
          if (message.error) {
            // reject the whole message if there are any errors
            try {
              this.pendingBatches[ids].reject(batch);
              delete this.pendingBatches[ids];
            } catch (e) {
              if (e instanceof TypeError) {
                // no outstanding calls
              }
            }
          }
        });
        try {
          this.pendingBatches[ids].resolve(batch);
          delete this.pendingBatches[ids];
        } catch (e) {
          if (e instanceof TypeError) {
            // no outstanding calls
          }
        }
      }
    }
  }

  /**
   * @params {String} [method] method to subscribe to
   * @params {Function} [cb] callback function to invoke on notify
   */
  subscribe(method, cb) {
    if (method === "batchResponse") {
      throw new Error("\"batchResponse\" is a reserved event name");
    }
    this.on(method, cb);
  }

  /**
   * @params {String} [method] method to unsubscribe from
   * @params {Function} [cb] name of function to remove
   */
  unsubscribe(method, cb) {
    if (method === "batchResponse") {
      throw new Error("\"batchResponse\" is a reserved event name");
    }
    this.removeListener(method, cb);
  }

  /**
   * @params {String} [method] method to unsubscribe all listeners from
   */
  unsubscribeAll(method) {
    if (method === "batchResponse") {
      throw new Error("\"batchResponse\" is a reserved event name");
    }
    this.removeAllListeners([method]);
  }
}

module.exports = WSClient;
