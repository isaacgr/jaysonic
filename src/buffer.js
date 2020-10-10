class MessageBuffer {
  /**
   * we can receive whole messages, or parital so we need to buffer
   *
   * whole message: {"jsonrpc": 2.0, "params": ["hello"], id: 1}\n
   *
   * partial message: {"jsonrpc": 2.0, "params"
   */
  constructor(delimiter) {
    this.delimiter = delimiter;
    this.buffer = "";
  }

  isFinished() {
    if (
      this.buffer.length === 0
      || this.buffer.indexOf(this.delimiter) === -1
    ) {
      return true;
    }
    return false;
  }

  push(data) {
    this.buffer += data;
  }

  getMessage() {
    const delimiterIndex = this.buffer.indexOf(this.delimiter);
    if (delimiterIndex !== -1) {
      const message = this.buffer.slice(0, delimiterIndex);
      this.buffer = this.buffer.replace(message + this.delimiter, "");
      return message;
    }
    return null;
  }

  handleData() {
    /**
     * Try to accumulate the buffer with messages
     *
     * If the server isnt sending delimiters for some reason
     * then nothing will ever come back for these requests
     */
    return this.getMessage();
  }
}

module.exports = { MessageBuffer };
