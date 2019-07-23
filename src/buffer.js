/**
 * Stack class
 *
 * Used for message buffer handling
 */

class Stack {
  constructor() {
    this.items = [];
  }

  push(item) {
    this.items.push(item);
  }

  pop() {
    return this.items.pop();
  }

  isEmpty() {
    return this.items.length === 0;
  }

  peek() {
    if (this.items.length !== 0) {
      return this.items.slice(-1)[0];
    }
  }

  getStack() {
    return this.items;
  }
}

class MessageBuffer {
  constructor(delimiter) {
    this.stack = new Stack();
    this.delimiter = delimiter;
  }

  handleData(data) {
    for (const message of data.split(this.delimiter)) {
      if (!(message === "")) {
        try {
          JSON.parse(message);
          /**
           * if this worked then assume its a full message
           * that can be sent back for validation
           */
          return this.stack.pop();
        } catch (e) {
          if (e instanceof SyntaxError) {
            /**
             * Try to accumulate the buffer with messages
             *
             * If the server isnt sending delimiters for some reason
             * then nothing will ever come back for these requests
             */
            this.stack.push(data);
            this.isWholeMessage();
          }
        }
      }
    }
  }
}

export { MessageBuffer as default };
