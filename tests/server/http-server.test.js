const { expect } = require("chai");
const Jayson = require("../../src");

const server = new Jayson.server.http({ port: 8000 });
const { clienthttp } = require("../test-client");

server.method("add", ([a, b]) => a + b);

server.method("greeting", ({ name }) => `Hello ${name}`);

server.method("typeerror", ([a]) => {
  if (typeof a !== "string") {
    throw new TypeError();
  }
});

describe("HTTP Server", () => {
  describe("connection", () => {
    it("should listen for requests", (done) => {
      const conn = server.listen();
      conn.then((result) => {
        expect(result).to.be.eql({
          host: "127.0.0.1",
          port: 8000
        });
        done();
      });
    });
  });
});
