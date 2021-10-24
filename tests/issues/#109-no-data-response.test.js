const { expect } = require("chai");
const Jaysonic = require("../../src");
const { server } = require("../test-server");

const tcpclient = new Jaysonic.client.tcp();

server.method("dataError", () => {
  const error = new Error("errrorWithData");
  error.data = [{ foo: "bar" }];
  throw error;
});

server.method(
  "promise.dataError",
  () => new Promise((resolve, reject) => {
    const error = new Error("reject");
    error.data = [{ foo: "bar" }];
    reject(error);
  })
);

describe("#109 Return Data Parameter from Client", () => {
  describe("client", () => {
    before(async () => {
      await server.listen();
      await tcpclient.connect();
    });
    after(async () => {
      await tcpclient.end();
      await server.close();
    });
    it("should return data parameter from client if server responds with one", async () => {
      try {
        await tcpclient.send("dataError");
      } catch (e) {
        expect(e.error).to.have.property("data");
        expect(e.error.data).to.be.eql([{ foo: "bar" }]);
      }
    });
    it("should return data parameter from client if server responds with one from a promise method", async () => {
      try {
        await tcpclient.send("promise.dataError");
      } catch (e) {
        expect(e.error).to.have.property("data");
        expect(e.error.data).to.be.eql([{ foo: "bar" }]);
      }
    });
  });
});
