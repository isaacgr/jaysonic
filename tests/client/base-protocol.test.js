const { expect } = require("chai");
const JsonRpcClientProtocol = require("../../src/client/protocol/base");

describe("Base Client Protocol", () => {
  describe("verifyData", () => {
    it("should raise a syntax error if the message is not an object", (done) => {
      const chunk = 1;
      const base = new JsonRpcClientProtocol({}, 2, "\n");
      try {
        base.verifyData(chunk);
      } catch (e) {
        expect(e.message).to.eql(
          "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32700,\"message\":\"Unable to parse message: '1'\"},\"id\":null}\n"
        );
      }
      done();
    });
    it("should raise an error if message has no error or response member, but has an id", (done) => {
      const chunk = "{ \"id\": 1 }";
      const base = new JsonRpcClientProtocol({}, 2, "\n");
      try {
        base.verifyData(chunk);
      } catch (e) {
        expect(e.message).to.eql(
          "{\"jsonrpc\":\"2.0\",\"error\":{\"code\":-32001,\"message\":\"Unknown Error\"},\"id\":null}\n"
        );
      }
      done();
    });
  });
});
