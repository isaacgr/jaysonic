const { expect } = require("chai");
const chai = require("chai");
const spies = require("chai-spies");
const JsonRpcServerProtocol = require("../../src/server/protocol/base");
const { formatError } = require("../../src/util/format");

chai.config.truncateThreshold = 0;

chai.use(spies);

const server = new JsonRpcServerProtocol({}, {}, 2, "\n");
server.writeToClient = message => message;

describe("Base Server Protocol Errors", () => {
  it("should return \"unknown\" error if message cannot be parsed", (done) => {
    const callback = chai.spy.on(server, "writeToClient");
    server.gotError("foo");
    expect(callback).to.have.been.called.with(
      formatError({
        jsonrpc: 2,
        id: null,
        code: -32001,
        message: JSON.stringify("foo", Object.getOwnPropertyNames("foo")),
        delimiter: "\n"
      })
    );
    done();
  });
});
