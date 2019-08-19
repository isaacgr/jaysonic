const { MessageBuffer } = require("./buffer");

class TCPServerProtocol {
  constructor(client, delimiter) {
    this.client = client;
    this.factory = null;
    this.delimiter = delimiter;
    this.messageBuffer = new MessageBuffer(delimiter);
  }

  clientConnected() {
    this.client.on("data", (data) => {
      this.messageBuffer.push(data);
      while (!this.messageBuffer.isFinished()) {
        const chunk = this.messageBuffer.handleData();
        Promise.all(this.factory.handleValidation(chunk))
          .then((validationResult) => {
            const message = validationResult[1];
            if (message.batch) {
              this.client.write(JSON.stringify(message.batch) + this.delimiter);
            } else if (message.notification) {
              this.factory.emit("notify", message.notification);
            } else {
              this.factory
                .getResult(message)
                .then(result => this.client.write(result + this.delimiter))
                .catch(error => this.client.write(JSON.stringify(error) + this.delimiter));
            }
          })
          .catch(error => this.client.write(JSON.stringify(error) + this.delimiter));
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

class WSServerProtocol {
  constructor(client, delimiter) {
    this.client = client;
    this.factory = null;
    this.delimiter = delimiter;
    this.messageBuffer = new MessageBuffer(delimiter);
  }

  clientConnected() {
    this.client.on("message", (data) => {
      this.messageBuffer.push(data);
      while (!this.messageBuffer.isFinished()) {
        const chunk = this.messageBuffer.handleData();
        Promise.all(this.factory.handleValidation(chunk))
          .then((validationResult) => {
            const message = validationResult[1];
            if (message.batch) {
              this.client.send(JSON.stringify(message.batch) + this.delimiter);
            } else if (message.notification) {
              this.factory.emit("notify", message.notification);
            } else {
              this.factory
                .getResult(message)
                .then(result => this.client.send(result + this.delimiter))
                .catch(error => this.client.send(JSON.stringify(error) + this.delimiter));
            }
          })
          .catch(error => this.client.send(JSON.stringify(error) + this.delimiter));
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

module.exports = { TCPServerProtocol, WSServerProtocol };
