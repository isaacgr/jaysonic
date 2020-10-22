/**
 * Creates an instance of MessageBuffer.<br/>
 *
 * The buffer accumulates received data and returns true or false for when a delimiter has been recieved.<br/>
 *
 * If a delimiter is recieved into the buffer, the message up to that point can be
 * removed from the buffer and returned.
 *
 * @example
 * // We can receive whole messages or parital, so we need to buffer
 *
 * {"jsonrpc": 2.0, "params": ["hello"], id: 1}\n // whole message
 * // or
 * {"jsonrpc": 2.0, "params" // partial message
 */
class MessageBuffer {
  /**
   * @param {string} delimiter The delimiter to use to determine if a message is complete
   * @example
   *    const messageBuffer = new MessageBuffer('\n')
   */
  constructor(delimiter) {
    this.delimiter = delimiter;
    this.buffer = "";
  }

  /**
   * Used to determine if the buffer is empty. Buffer is considered
   * empty if its an empty string or contains no delimiter
   *
   * @returns {boolean}
   * @example
   * while(!messageBuffer.isFinished()){
   *    // get current data and verify
   * }
   */
  isFinished() {
    if (
      this.buffer.length === 0
      || this.buffer.indexOf(this.delimiter) === -1
    ) {
      return true;
    }
    return false;
  }

  /**
   * Accumulate the buffer with messages.
   *
   * If the server isnt sending delimiters for some reason
   * then nothing will ever come back for these requests.
   *
   * @param {string} data Data to push into buffer
   * @example
   *    messageBuffer.push("hello\n")
   */
  push(data) {
    this.buffer += data;
  }

  /**
   * Return the message from the buffer if delimiter is found, and null otherwise.
   *
   * The message is everything before the delimiter.
   *
   * Replace message string in buffer with empty string.
   *
   * @returns {string|null} message
   * @example
   * const message = messageBuffer.getMessage()
   * console.log(message) // "hello"
   *
   */
  getMessage() {
    const delimiterIndex = this.buffer.indexOf(this.delimiter);
    if (delimiterIndex !== -1) {
      const message = this.buffer.slice(0, delimiterIndex);
      this.buffer = this.buffer.replace(message + this.delimiter, "");
      return message;
    }
    return null;
  }

  /**
   * @returns {function} MessageBuffer.getMessage()
   */
  handleData() {
    return this.getMessage();
  }
}

module.exports = MessageBuffer;
