const { expect } = require("chai");
const Jaysonic = require("../../src");
const { server } = require("../test-server");

const client = new Jaysonic.client.tcp();

describe("request().send()", () => {
  before((done) => {
    server.listen().then(() => {
      client.connect().then(() => {
        done();
      });
    });
  });
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
      const request = client.request().send("params", 1);
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
    it("should throw error if params is string", (done) => {
      const request = client.request().send("params", "test");
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
    it("should throw error if params is function", (done) => {
      const request = client.request().send("params", () => "test");
      request.catch((error) => {
        expect(error).to.be.instanceOf(Error);
        done();
      });
    });
  });
});
