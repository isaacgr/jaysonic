const { expect } = require("chai");
const intercept = require("intercept-stdout");
const JsonRpcClientProtocol = require("../../src/client/protocol/base");
const JsonRpcClientFactory = require("../../src/client/");

const factory = new JsonRpcClientFactory({});
const client = new JsonRpcClientProtocol(factory, 2, "\n");

describe("Base Client Protocol Errors", () => {
  it("should log an error if gotResponse gets a TypeError", (done) => {
    client.gotResponse({ id: 1 });
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Message has no outstanding calls: {\"id\": 1}.\n"
      );
    }, 100);
    done();
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
    client._timeoutPendingCalls(1);
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Message has no outstanding calls. ID [1]\n"
      );
    }, 100);
    done();
  });
  it("should log an error if _resolveOrRejectBatch gets a TypeError", (done) => {
    client._resolveOrRejectBatch([], "1,2");
    let capturedText = "";
    const unhook = intercept((text) => {
      capturedText += text;
    });
    setTimeout(() => {
      unhook();
      expect(capturedText).to.equal(
        "Batch response has no outstanding calls. Response IDs [1,2]\n"
      );
    }, 100);
    done();
  });
});
