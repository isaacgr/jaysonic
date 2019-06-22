const server = require("../server.js");

const Jaysonic = require("../../src");
const expect = require("chai").expect;

const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 8100 });

// basing tests off of https://www.jsonrpc.org/specification

beforeEach(done => {
  client.connect().then(() => {
    done();
  });
});

after(() => {
  client.end().then(() => {
    server.close();
  });
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
    it("should hanlde a connection refused error", done => {
      const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 8101 });
      const connection = client.connect();
      connection.catch(error => {
        expect(error.code).to.equal("ECONNREFUSED");
        done();
      });
    });
  });
  describe("requests", () => {
    it("should receive response for positional params", done => {
      const request = client.request("add", [1, 2]);
      request.then(response => {
        expect(response).to.eql({ jsonrpc: "2.0", result: 3, id: 1 });
        done();
      });
    });
    it("should receive response for named params", done => {
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
    it("should handle 'method not found' error", done => {
      const request = client.request("nonexistent method", []);
      request.catch(error => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 3
        });
        done();
      });
    });
    it("should handle 'invalid params' error", done => {
      const request = client.request("object", []);
      request.catch(error => {
        expect(error).to.eql({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid parameters" },
          id: 4
        });
        done();
      });
    });
  });
  describe("notifications", () => {
    it("should handle receiving a notification", done => {
      client.subscribe("notification", message => {
        expect(message).to.eql({
          jsonrpc: "2.0",
          method: "notification",
          params: []
        });
      });
      server.notify({
        method: "notification",
        params: []
      });
      done();
    });
  });
});
