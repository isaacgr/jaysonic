const { expect } = require("chai");
const chai = require("chai");
const spies = require("chai-spies");
const { server } = require("../test-server");
const Jaysonic = require("../../src");

chai.use(spies);

const client = new Jaysonic.client.tcp({ retries: 1 });

describe("Base Client Reconnect", () => {
  before((done) => {
    server.listen().then(() => {
      done();
    });
  });
  it("should invoke callback when server disconnects", (done) => {
    const obj = {
      cb: () => {}
    };
    const callback = chai.spy.on(obj, "cb");
    client.serverDisconnected(obj.cb);
    client.connect().then(() => {
      server.close().then(() => {
        setTimeout(() => {
          expect(callback).to.have.been.called();
          done();
        }, 500);
      });
    });
  });
});
