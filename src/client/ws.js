const _ = require("lodash");
const { formatRequest } = require("../functions");
const { ERR_CODES, ERR_MSGS } = require("../constants");

class WSClient {
  constructor(options) {
    if (!(this instanceof WSClient)) {
      return new WSClient(options);
    }

    const defaults = {
      url: "wss://www.example.com/socketserver",
      version: "2.0",
      delimiter: "\n",
      path: "/",
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

    this.initClient();
  }

  initClient() {
    const { url, protocols } = this.options;
    this.client = new WebSocket(url, protocols);
    this.listen();
    this.handleResponse();
    this.handleError();
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
          this.client.send(
            this.request().message(method, params),
            this.options.protocols
          );
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
        try {
          this.handleBatchResponse(message);
        } catch (e) {
          const error = this.sendError({
            id: this.serving_message_id,
            code: ERR_CODES.parseError,
            message: ERR_MSGS.parseError
          });
          this.handleBatchError(error);
        }
      }

      if (!_.isObject(message)) {
        // error out if it cant be parsed
        const error = this.sendError({
          id: null,
          code: ERR_CODES.parseError,
          message: ERR_MSGS.parseError
        });
        throw new Error(error);
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
        throw new Error(error);
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
      throw new Error(error);
    }
  }

  listen() {
    this.client.onmessage = (message) => {
      this.verifyData(message.data);
    };
  }

  handleResponse() {}

  handleError() {
    this.client.onerror = (error) => {
      console.log(error);
    };
  }
}

module.exports = WSClient;
