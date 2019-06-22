const Jaysonic = require("../../src");
const expect = require("chai").expect;

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 6969 });
const { client, socket } = require("../client.js");

// basing tests off of https://www.jsonrpc.org/specification

before(done => {
  server.listen().then(() => {
    done();
  });
});

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
      client.connect().then(() => {
        done();
      });
    });
    it("should log disconnected clients", done => {
      server.clientDisconnected(conn => {
        expect(conn).to.have.all.keys("host", "port");
      });
      client.end().then(() => {
        done();
      });
    });
  });
  describe("requests", () => {
    it("should handle call with positional params", done => {
      const req = client.request("add", [1, 2]);
      req.then(result => {
        console.log(result);
        expect(result)
          .to.eql({
            jsonrpc: "2.0",
            result: 3,
            id: 1
          })
          .finally(done);
      });
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
        done();
      });
    });
    it("should send 'method not found' error", done => {
      const req = client.request("nonexistent", []);
      req.then(result => {
        expect(result).to.eqx({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 3
        });
        done();
      });
    });
    it("should send 'parse error'", done => {
      let message = "";
      socket.write("test");
      socket.on("data", data => {
        message += data;
        expect(message).to.eql(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse Error" },
            id: null
          }) + "\r\n"
        );
        socket.destroy();
      });
      socket.on("close", () => {
        done();
      });
    });
  });
});
