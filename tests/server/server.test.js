const Jaysonic = require("../../src");
const expect = require("chai").expect;

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 6969 });
const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 6969 });

// basing tests off of https://www.jsonrpc.org/specification

beforeEach(done => {
  client.connect().then(() => {
    done();
  });
});

after(() => {
  server.close();
  client.end();
});

describe("TCP Server", () => {
  describe("connection", () => {
    it("should listen for connections", done => {
      const conn = server.listen();
      conn.then(result => {
        expect(result).to.eql({ host: "127.0.0.1", port: 6969 });
        done();
      });
    });
    it("should accept incoming connections", done => {
      server.clientConnected(conn => {
        expect(conn).to.have.all.keys("host", "port");
      });
      client.connect();
      done();
    });
    it("should log disconnected clients", done => {
      server.clientDisconnected(conn => {
        expect(conn).to.have.all.keys("host", "port");
      });
      client.end();
      done();
    });
  });
  describe("requests", () => {
    it("should handle call with positional params", done => {
      server.method("subtract", ([a, b]) => {
        return a - b;
      });
      const req = client.request("subtract", [1, 2]);
      req.then(result => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: -1,
          id: 1
        });
      });
      done();
    });
    it("should handle call with named params", done => {
      server.method("greeting", ({ name }) => {
        return `Hello ${name}`;
      });
      const req = client.request("greeting", { name: "Isaac" });
      req.then(result => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: "Hello Isaac",
          id: 2
        });
      });
      done();
    });
  });
});
