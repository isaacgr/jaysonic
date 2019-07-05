const _ = require("lodash");
const { formatRequest } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

class WSClient extends EventTarget {
  constructor(options) {
    super();
    if (!(this instanceof WSClient)) {
      return new WSClient(options);
    }

    const defaults = {
      url: "wss://www.example.com/socketserver",
      version: "2.0",
      delimiter: "\n",
      timeout: 30,
      retries: 2
    };

    this.message_id = 1;
    this.serving_message_id = 1;
    this.pendingCalls = {};
    this.pendingBatches = {};
    this.attached = false;

    /**
     * we can receive whole messages, or parital so we need to buffer
     *
     * whole message: {"jsonrpc": 2.0, "params": ["hello"], id: 1}
     *
     * partial message: {"jsonrpc": 2.0, "params"
     */
    this.messageBuffer = "";
    this.responseQueue = {};
    this.options = _.merge(defaults, options || {});
    this.options.timeout = this.options.timeout * 1000;
    let { retries } = this.options;
    this.remainingRetries = retries;

    this.initClient();
  }

  initClient() {
    const { url, protocols } = this.options;
    this.client = new WebSocket(url);
    this.close();
    this.listen();
    this.client.onerror = (error) => {
      this.client.close();
    };
  }

  close() {
    this.client.onclose = (e) => {
      if (this.remainingRetries) {
        this.remainingRetries -= 1;
        console.log(
          `Connection failed. ${this.remainingRetries} attempts left.`
        );
        setTimeout(() => {
          this.initClient();
        }, this.options.timeout);
      } else {
        return;
      }
    };
  }

  onConnection() {
    console.log("called");
    return new Promise((resolve, reject) => {
      this.client.onopen = (event) => {
        resolve(event);
      };
    });
  }

  request() {
    return {
      message: (method, params) => {
        const request = formatRequest({
          method,
          params,
          id: this.message_id,
          options: this.options
        });
        this.message_id += 1;
        return request;
      },
      send: (method, params) =>
        new Promise((resolve, reject) => {
          const requestId = this.message_id;
          this.pendingCalls[requestId] = { resolve, reject };
          this.client.send(this.request().message(method, params));
          setTimeout(() => {
            if (this.pendingCalls[requestId]) {
              const error = this.sendError({
                id: requestId,
                code: ERR_CODES.timeout,
                message: ERR_MSGS.timeout
              });
              delete this.pendingCalls[requestId];
              reject(error);
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
          resolve(this.client.send(request));
          this.client.onerror = (error) => {
            reject(error);
          };
        });
      }
    };
  }

  verifyData(chunk) {
    try {
      // will throw an error if not valid json
      const message = JSON.parse(chunk);
      if (_.isArray(message)) {
        // possible batch request
        this.handleBatchResponse(message);
      }

      if (!_.isObject(message)) {
        // error out if it cant be parsed
        const error = this.sendError({
          id: null,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError
        });
        this.handleError(error);
      }

      if (!message.id) {
        // no id, so assume notification
        this.handleNotification(message);
      }

      if (message.error) {
        // got an error back so reject the message
        const error = this.sendError({
          jsonrpc: message.jsonrpc,
          id: message.id,
          code: message.error.code,
          message: message.error.message
        });
        this.handleError(error);
      }

      // no method, so assume response
      if (!message.method) {
        this.serving_message_id = message.id;
        this.responseQueue[this.serving_message_id] = message;
        this.handleResponse(message);
      }
    } catch (e) {
      const error = this.sendError({
        id: this.serving_message_id,
        code: ERR_CODES.parseError,
        message: ERR_MSGS.parseError
      });
      this.handleError(error);
    }
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
      let batchRequest = [];
      for (const request of requests) {
        const json = JSON.parse(request);
        batchRequest.push(json);
        if (json.id) {
          batchIds.push(json.id);
        }
      }
      this.pendingBatches[String(batchIds)] = { resolve, reject };

      this.client.send(JSON.stringify(batchRequest) + this.options.delimiter);
    });
  }

  handleBatchResponse(batch) {
    try {
      const batchResponseIds = [];
      batch.forEach((message) => {
        if (message.error) {
          // reject the whole message if there are any errors
          reject(batch);
        }
        if (message.id) {
          batchResponseIds.push(message.id);
        }
      });
      if (_.isEmpty(batchResponseIds)) {
        resolve([]);
      }
      for (const ids of Object.keys(this.pendingBatches)) {
        if (_.isEmpty(_.difference(JSON.parse(`[${ids}]`), batchResponseIds))) {
          this.pendingBatches[ids].resolve(batch);
        }
      }
    } catch (e) {
      reject(batch);
    }
  }
  handleNotification(message) {
    this.dispatchEvent(new CustomEvent("notify", { detail: message }));
  }

  /**
   * @params {String} [method] method to subscribe to
   * @params {Function} [cb] callback function to invoke on notify
   */
  subscribe(method, cb) {
    this.addEventListener("notify", ({ detail }) => {
      try {
        if (detail.method === method) {
          return cb(undefined, detail);
        }
      } catch (e) {
        return cb(e);
      }
    });
  }

  listen() {
    this.client.onmessage = (message) => {
      this.verifyData(message.data);
    };
  }

  handleResponse(message) {
    if (!(this.pendingCalls[message.id] === undefined)) {
      let response = this.responseQueue[message.id];
      this.pendingCalls[message.id].resolve(response);
      delete this.responseQueue[message.id];
    }
  }

  handleError(error) {
    let response = error;
    this.pendingCalls[error.id].reject(response);
  }

  sendError({ jsonrpc, id, code, message }) {
    let response;
    if (this.options.version === "2.0") {
      response = {
        jsonrpc: jsonrpc || this.options.version,
        error: { code, message: message || "Unknown Error" },
        id
      };
    } else {
      response = {
        result: null,
        error: { code, message: message || "Unknown Error" },
        id
      };
    }
    return response;
  }
}

module.exports = WSClient;
