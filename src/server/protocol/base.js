const { MessageBuffer } = require("../../buffer");

class JsonRpcServerProtocol {
  // base protocol class for servers
  constructor(factory, client, delimiter) {
    this.client = client;
    this.factory = factory;
    this.delimiter = delimiter;
    this.messageBuffer = new MessageBuffer(delimiter);
    this.event = "data";
  }

  writeToClient(message) {
    this.client.write(message);
  }

  clientConnected() {
    this.client.on(this.event, (data) => {
      this.messageBuffer.push(data);
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
              this.factory.emit(
                message.notification.method,
                message.notification
              );
            } else {
              this.factory
                .getResult(message)
                .then((result) => this.writeToClient(result))
                .catch((error) => {
                  this.writeToClient(error);
                });
            }
          })
          .catch((error) => {
            this.writeToClient(error.message);
          });
      }
    });
    this.client.on("close", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
    this.client.on("end", () => {
      this.factory.emit("clientDisconnected", this.client);
    });
  }
}

module.exports = JsonRpcServerProtocol;
