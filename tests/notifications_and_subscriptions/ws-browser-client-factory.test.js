const { expect } = require("chai");
const Jaysonic = require("../../src/client-ws");

const ws = new Jaysonic.wsclient();
const cb = () => {};

describe("WS Client Factory", () => {
  it("should add method to event listeners list", (done) => {
    ws.subscribe("foo", cb);
    expect(ws.eventListenerList).to.eql({
      foo: [{ type: "foo", listener: cb }]
    });
    done();
  });
  it("should remove all methods from event listeners list", (done) => {
    ws.unsubscribeAll("foo");
    expect(ws.eventListenerList).to.eql({});
    done();
  });
});
