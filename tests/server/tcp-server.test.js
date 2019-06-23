const { expect } = require("chai");
const Jaysonic = require("../../src");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 6969 });
const server2 = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 7070 });

const { client, socket, sock } = require("../client.js");

server.method("add", ([a, b]) => a + b);

server.method("greeting", ({ name }) => `Hello ${name}`);

server.method("typeerror", ([a]) => {
  if (typeof a !== "string") {
    throw new TypeError();
  }
});

// basing tests off of https://www.jsonrpc.org/specification

before((done) => {
  server.listen().then(() => {
    socket.connect(6969, "127.0.0.1", () => {
      server2.listen().then(() => {
        sock.connect(7070, "127.0.0.1", () => {
          done();
        });
      });
    });
  });
});

beforeEach((done) => {
  client.connect().then(() => {
    done();
  });
});

after(() => {
  client.end().then(() => {
    server.close();
    server2.close();
    socket.destroy();
    sock.destroy();
  });
});

describe("TCP Server", () => {
  describe("connection", () => {
    it("should accept incoming connections", (done) => {
      server.clientConnected((conn) => {
        expect(conn).to.have.all.keys("host", "port");
      });
      client.connect().then(() => {
        done();
      });
    });
    it("should log disconnected clients", (done) => {
      server.clientDisconnected((conn) => {
        expect(conn).to.have.all.keys("host", "port");
      });
      client.end().then(() => {
        done();
      });
    });
  });
  describe("requests", () => {
    it("should handle call with positional params", (done) => {
      const req = client.request("add", [1, 2]);
      req.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: 3,
          id: 1,
        });
        done();
      });
    });
    it("should handle call with named params", (done) => {
      server.method("greeting", ({ name }) => `Hello ${name}`);
      const req = client.request("greeting", { name: "Isaac" });
      req.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: "Hello Isaac",
          id: 2,
        });
        done();
      });
    });
    it("should send 'method not found' error", (done) => {
      const req = client.request("nonexistent", []);
      req.catch((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 3,
        });
        done();
      });
    });
    it("should send 'invalid params' error", (done) => {
      const req = client.request("typeerror", [1]);
      req.catch((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid Parameters" },
          id: 4,
        });
        done();
      });
    });
    it("should send 'parse error'", (done) => {
      client.end().then(() => {
        let message = "";
        socket.write("test");
        socket.on("data", (data) => {
          message += data;
          const messages = message.split("\r\n");
          messages.forEach((chunk) => {
            try {
              expect(chunk).to.eql(
                `${JSON.stringify({
                  jsonrpc: "2.0",
                  error: { code: -32700, message: "Parse Error" },
                  id: null,
                })}\r\n`,
              );
            } catch (e) {
              if (messages.indexOf(chunk) === messages.length) {
                throw e;
              }
            }
          });
          socket.destroy();
        });
        socket.on("close", () => {
          done();
        });
      });
    });
    it("should send 'invalid request' error", (done) => {
      client.end().then(() => {
        let message = "";
        sock.write(
          `${JSON.stringify({
            jsonrpc: "2.0",
            method: "add",
            params: [],
          })}\r\n`,
        );
        sock.on("data", (data) => {
          message += data;
          const messages = message.split("\r\n");
          messages.forEach((chunk) => {
            try {
              expect(chunk).to.eql(
                `${JSON.stringify({
                  jsonrpc: "2.0",
                  error: { code: -32600, message: "Invalid Request" },
                  id: null,
                })}\r\n`,
              );
            } catch (e) {
              if (messages.indexOf(chunk) === messages.length) {
                throw e;
              }
            }
          });
          sock.destroy();
        });
        sock.on("close", () => {
          done();
        });
      });
    });
  });
});
