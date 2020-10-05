const Client = require("./index2");
const TcpClientProtocol = require("./protocol/tcp");
const { formatError } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

/**
 * Constructor for Jsonic TCP client
 * @class TCPClient
 * @constructor
 * @extends Client
 * @param {Object} [options] optional settings for client
 * @return TCPClient
 */
class TCPClient extends Client {
  constructor(options) {
    super(options);
    // this.request = this._request();
  }

  connect() {
    if (this.pcolInstance) {
      // not having this caused MaxEventListeners error
      return Promise.reject(Error("client already connected"));
    }
    this.pcolInstance = new TcpClientProtocol(
      this,
      this.options.version,
      this.options.delimiter
    );
    return this.pcolInstance.connect();
  }

  end(cb) {
    this.pcolInstance.end(cb);
  }

  request() {
    return this.pcolInstance.request();
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
        this.client.write(request + this.options.delimiter);
      } catch (e) {
        // this.client is probably undefined
        reject(e.message);
      }
      this.timeouts[String(batchIds)] = setTimeout(() => {
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

module.exports = TCPClient;
