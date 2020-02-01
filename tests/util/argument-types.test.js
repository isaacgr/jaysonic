const { expect } = require("chai");
const Jaysonic = require("../../src");

const client = new Jaysonic.client.tcp({ port: 9999 });
const server = new Jaysonic.server.tcp({ port: 9999 });

before((done) => {
  server.listen().then(() => {
    client.connect().then(() => {
      done();
    });
  });
});

describe("request().send()", () => {
  describe("methods", () => {
    it("should throw error if method is number", (done) => {
      const request = client.request().send(1, []);
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
    it("should throw error if method is object", (done) => {
      const request = client.request().send({}, []);
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
    it("should throw error if method is array", (done) => {
      const request = client.request().send([], []);
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
  });
  describe("params", () => {
    it("should throw error if params is number", (done) => {
      const request = client.request().send("add", 1);
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
    it("should throw error if params is string", (done) => {
      const request = client.request().send("add", "test");
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
    it("should throw error if params is function", (done) => {
      const request = client.request().send("add", () => "test");
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
  });
});
