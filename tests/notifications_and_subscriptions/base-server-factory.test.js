const { expect } = require("chai");
const JsonRpcServerFactory = require("../../src/server");

const base = new JsonRpcServerFactory({}, {}, 2, "\n");
const cb = () => {};

describe("Base Server Factory Subscriptions", () => {
  it("should remove method from event listeners list", (done) => {
    base.onNotify("foo", cb);
    expect(base.eventNames()).to.have.length(1);
    base.removeOnNotify("foo", cb);
    expect(base.eventNames()).to.have.length(0);
    done();
  });
  it("should remove all methods from event listeners list", (done) => {
    base.onNotify("foo", cb);
    const cb2 = () => {};
    base.onNotify("foo", cb2);
    expect(base.eventNames()).to.have.length(1);
    base.removeAllOnNotify("foo");
    expect(base.eventNames()).to.have.length(0);
    done();
  });
});
