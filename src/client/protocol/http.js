const http = require("http");
const https = require("https");
const JsonRpcClientProtocol = require("./base");

class HttpClientProtocol extends JsonRpcClientProtocol {
  constructor(factory, version, delimiter) {
    super(factory, version, delimiter);
    this.headers = this.factory.headers;
    this.encoding = this.factory.encoding;
    this.scheme = this.factory.scheme;
  }

  write(request, cb) {
    const options = {
      ...this.factory.options,
      ...this.headers
    };
    this.headers["Content-Length"] = Buffer.byteLength(request, this.encoding);
    const responseCallback = (response) => {
      if (cb) {
        response.on("end", cb);
      }
      this.listener = response;
      this.listen();
    };
    if (this.scheme === "http") {
      this.connector = http.request(options, responseCallback);
    } else if (this.scheme === "https") {
      this.connector = https.request(options, responseCallback);
    } else {
      throw Error("Invalid scheme");
    }
    this.connector.write(request, this.encoding);
    this.connector.end();
    this.connector.on("close", () => {
      this.factory.emit("serverDisconnected");
    });
    this.connector.on("error", (error) => {
      throw error;
    });
  }

  listen() {
    this.listener.on("data", (data) => {
      this._waitForData(data);
    });
  }

  _waitForData(data) {
    try {
      this.verifyData(data);
    } catch (e) {
      this.handleError(e);
    }
  }

  notify(method, params) {
    return new Promise((resolve, reject) => {
      const request = this.message(method, params, false);
      try {
        this.write(request, () => {
          if (this.listener.statusCode === 204) {
            resolve(this.listener);
          } else {
            reject(new Error("no response receieved for notification"));
          }
        });
      } catch (e) {
        // this.connector is probably undefined
        reject(e);
      }
    });
  }

  getResponse(id) {
    return {
      body: this.responseQueue[id],
      headers: {
        ...this.connector.headers
      }
    };
  }

  getBatchResponse(batch) {
    return {
      body: batch,
      headers: {
        ...this.connector.headers
      }
    };
  }

  rejectPendingCalls(error) {
    const err = {
      body: error,
      headers: {
        ...this.connector.headers
      }
    };
    try {
      this.pendingCalls[err.body.id].reject(err);
      this.factory.cleanUp(err.body.id);
    } catch (e) {
      if (e instanceof TypeError) {
        // probably a parse error, which might not have an id
        console.error(
          `Message has no outstanding calls: ${JSON.stringify(err.body)}`
        );
      }
    }
  }
}

module.exports = HttpClientProtocol;
