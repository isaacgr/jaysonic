const server = require("../server");

const Jaysonic = require("../../src");
const expect = require("chai").expect;

const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 8100 });

// basing tests off of https://www.jsonrpc.org/specification

beforeEach(done => {
  client.connect();
  done();
});

describe("TCP Client", () => {
  describe("connection", () => {
    it("should connect to server", done => {
      const connection = client.connect();
      connection.then(result => {
        expect(result).to.eql({ host: "127.0.0.1", port: 8100 });
        done();
      });
    });
    it("should fail to connect to server", done => {
      const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 8101 });
      const connection = client.connect();
      connection.catch(error => {
        expect(error.code).to.equal("ECONNREFUSED");
        done();
      });
    });
  });
  describe("requests", () => {
    it("should receive response for params array", done => {
      const request = client.request("add", [1, 2]);
      request.then(response => {
        expect(response).to.eql({ jsonrpc: "2.0", result: 3, id: 1 });
        done();
      });
    });
    it("should receive response for params object", done => {
      const request = client.request("object", { name: "Isaac", age: 27 });
      request.then(response => {
        expect(response).to.eql({
          jsonrpc: "2.0",
          result: { name: "Isaac", age: 27 },
          id: 2
        });
        done();
      });
    });
  });
});
