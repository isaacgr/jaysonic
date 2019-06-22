const Jaysonic = require("../../src");
const expect = require("chai").expect;
const net = require("net");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 6969 });
const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 6969 });

server.method("add", ([a, b]) => {
  return a + b;
});

// basing tests off of https://www.jsonrpc.org/specification

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
    it("should send 'method not found' error", done => {
      const req = client.request("nonexistent", []);
      req.then(result => {
        expect(result).to.eqx({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 3
        });
      });
      done();
    });
    describe("erroroneous requests", () => {
      it("should send parse error", done => {
        const socket = new net.Socket();
        socket.connect({ host: "127.0.0.1", port: 6969 });
        socket.setEncoding("utf8");
        let message = "";
        socket.write(
          JSON.stringify({
            jsonrpc: "2.0",
            method: "add",
            params: "",
            id: 99
          }) + "[]\r\n"
        );
        socket.on("data", data => {
          message += data.trimLeft();
          const messages = message.split("\r\n");
          for (let chunk of messages) {
            if (chunk !== "") {
              expect(chunk).to.eql(
                JSON.stringify({
                  jsonrpc: "2.0",
                  error: { code: -32700, message: "Parse Error" },
                  id: null
                })
              );
              socket.end(() => {
                done();
              });
            }
          }
        });
      });
    });
  });
});
