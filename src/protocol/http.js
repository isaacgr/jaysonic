const JsonRpcServerProtocol = require("./base");

class HttpServerProtocol extends JsonRpcServerProtocol {
  constructor(factory, client, response, delimiter) {
    super(factory, client, delimiter);
    this.response = response;
  }

  writeToClient(message, notification) {
    if (notification) {
      this.factory.setResponseHeader({
        response: this.response,
        notification: true
      });
      this.response.end();
      return;
    }
    this.factory.setResponseHeader({ response: this.response });
    this.response.write(message, () => {
      this.response.end();
    });
  }

  clientConnected() {
    this.client.on(this.event, (data) => {
      this.messageBuffer.push(data);
    });
    this.client.on("end", () => {
      while (!this.messageBuffer.isFinished()) {
        const chunk = this.messageBuffer.handleData();
        this.factory
          .handleValidation(chunk)
          .then((message) => {
            if (message.batch) {
              if (message.batch.empty) {
                return;
              }
              this.writeToClient(
                JSON.stringify(message.batch) + this.delimiter
              );
            } else if (message.notification) {
              this.writeToClient(undefined, message.notification);
            } else {
              this.factory
                .getResult(message)
                .then((result) => {
                  this.writeToClient(result);
                })
                .catch((error) => {
                  this.sendError(error);
                });
            }
          })
          .catch((error) => {
            this.sendError(error.message);
          });
      }
    });
  }

  sendError(error) {
    this.factory.setResponseHeader({
      response: this.response,
      errorCode: JSON.parse(error).error.code || 500
    });
    this.response.write(error, () => {
      this.response.end();
    });
  }
}

module.exports = { HttpServerProtocol };
