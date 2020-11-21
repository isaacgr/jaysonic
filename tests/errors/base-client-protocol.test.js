const { expect } = require("chai");
const intercept = require("intercept-stdout");
const chai = require("chai");
const spies = require("chai-spies");
const JsonRpcClientProtocol = require("../../src/client/protocol/base");
const JsonRpcClientFactory = require("../../src/client/");
const { formatError } = require("../../src/util/format");

chai.use(spies);

const factory = new JsonRpcClientFactory({});
factory.requestTimeout = 100;
const client = new JsonRpcClientProtocol(factory, 2, "\n");

describe("Base Client Protocol Errors", () => {
  it("should log an error if gotResponse gets a TypeError", (done) => {
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    client.gotResponse({ id: 1 });
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Message has no outstanding calls: {\"id\":1}\n"
      );
      done();
    }, 100);
  });
  it("should reject .notify() if unable to write", (done) => {
    const res = client.notify("foo", []);
    res.catch((error) => {
      expect(error).to.be.instanceOf(Error);
      done();
    });
  });
  it("should reject .batch() if unable to write", (done) => {
    const res = client.batch([client.request().message("foo", [])]);
    res.catch((error) => {
      expect(error).to.be.instanceOf(Error);
      done();
    });
  });
  it("should log an error if _timeoutPendingCalls gets a TypeError", (done) => {
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    client._timeoutPendingCalls(69);
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Message has no outstanding calls. ID [69]\n"
      );
      done();
    }, 1000);
  }).timeout(5000);
  it("should log an error if _resolveOrRejectBatch gets a TypeError", (done) => {
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    client._resolveOrRejectBatch([], "1,2");
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Batch response has no outstanding calls. Response IDs [1,2]\n"
      );
      done();
    }, 100);
  });
  it("should call rejectPendingCalls with an unknown error if gotError cannot be parsed", (done) => {
    const base = new JsonRpcClientProtocol({}, 2, "\n");
    const callback = chai.spy.on(base, "rejectPendingCalls");
    base.gotError("foo");
    expect(callback).to.have.been.called.with(
      JSON.parse(
        formatError({
          jsonrpc: 2,
          id: null,
          code: -32001,
          message: JSON.stringify("foo", Object.getOwnPropertyNames("foo")),
          delimiter: "\n"
        })
      )
    );
    done();
  });
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
