const { expect } = require("chai");
const chai = require("chai");
const spies = require("chai-spies");
const Jaysonic = require("../../src");
const { server, serverV1 } = require("../test-server");
const { client, socket, socketV1 } = require("../test-client");

chai.use(spies);

server.method(
  "promise.resolve",
  () => new Promise((resolve) => {
    setTimeout(() => {
      resolve("resolve");
    }, 10);
  })
);
server.method(
  "promise.reject",
  () => new Promise((resolve, reject) => {
    setTimeout(() => {
      reject(new Error("reject"));
    }, 10);
  })
);

describe("TCP Server", () => {
  before((done) => {
    server.listen().then(() => {
      done();
    });
  });
  after((done) => {
    server.close().then(() => {
      done();
    });
  });
  describe("connection", () => {
    it("should accept incoming connections", (done) => {
      const method = chai.spy.on(server, "clientConnected");
      client.connect().then(() => {
        try {
          expect(method).to.have.been.called.with(server.clients[0]);
          client.end(() => {
            done();
          });
        } catch (e) {
          client.end(() => {
            done(e);
          });
        }
      });
    });
    it("should call clientDisconnected and remove client from this.clients", (done) => {
      const callback = chai.spy.on(server, "clientDisconnected");
      client.connect().then(() => {
        const c = server.clients[0];
        client.end(() => {
          setTimeout(() => {
            try {
              expect(callback).to.have.been.called.with(c);
              expect(server.clients).to.have.lengthOf(0);
              done();
            } catch (e) {
              done(e);
            }
          }, 500);
        });
      });
    });
    it("should return 'Unknown client' from clientDisconnected if client was not found", (done) => {
      let res;
      server.clientDisconnected = (pcol) => {
        res = server.removeDisconnectedClient(pcol);
      };
      server.clientDisconnected({});
      expect(res).to.be.eql({ error: "Unknown client {}" });
      done();
    });
    it("should be unable to listen multiple times", (done) => {
      const conn = server.listen();
      conn.catch((error) => {
        expect(error.message).to.be.a("string");
        done();
      });
    });
    it("should handle requests from multiple clients", (done) => {
      const client1 = new Jaysonic.client.tcp();
      const client2 = new Jaysonic.client.tcp();
      client1.connect().then(() => {
        client2.connect().then(() => {
          const req1 = client1.request().send("params", [1, 2]);
          const req2 = client2
            .request()
            .send("named.params", { name: "jaysonic" });
          Promise.all([req1, req2]).then((results) => {
            const [res1, res2] = results;
            expect(res1).to.eql({
              jsonrpc: "2.0",
              result: 3,
              id: 1
            });
            expect(res2).to.eql({
              jsonrpc: "2.0",
              result: "Hello jaysonic",
              id: 1
            });
            done();
          });
        });
      });
    });
  });
  describe("requests", () => {
    before((done) => {
      socket.connect(8100, "127.0.0.1", () => {
        client.connect().then(() => {
          done();
        });
      });
    });
    after((done) => {
      socket.destroy();
      socket.on("close", () => {
        done();
      });
    });
    it("should handle call with positional params", (done) => {
      const req = client.request().send("params", [1, 2]);
      req.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: 3,
          id: 1
        });
        done();
      });
    });
    it("should handle call with named params", (done) => {
      const req = client.request().send("named.params", { name: "jaysonic" });
      req.then((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          result: "Hello jaysonic",
          id: 2
        });
        done();
      });
    });
    it("should send 'method not found' error", (done) => {
      const req = client.request().send("foo", []);
      req.catch((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: 3
        });
        done();
      });
    });
    it("should send 'invalid params' error if server method throws a TypeError", (done) => {
      const req = client.request().send("type.error", [1]);
      req.catch((result) => {
        expect(result).to.eql({
          jsonrpc: "2.0",
          error: { code: -32602, message: "Invalid Parameters" },
          id: 4
        });
        done();
      });
    });
    it("should send 'invalid params' error if params is not an array or object", (done) => {
      let message = "";
      let noMore = false;
      socket.write(
        "{\"jsonrpc\":\"2.0\",\"method\":\"params\",\"params\":\"foo\",\"id\":88}\n"
      );
      socket.on("data", (data) => {
        message += data;
        const messages = message.split("\n");
        messages.forEach((chunk) => {
          if (chunk === "" || noMore) {
            return;
          }
          try {
            expect(chunk).to.eql(
              `${JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32602, message: "Invalid Parameters" },
                id: 88
              })}`
            );
            noMore = true;
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
    it("should send 'parse error'", (done) => {
      let message = "";
      let noMore = false;
      socket.write("foo\n");
      socket.on("data", (data) => {
        message += data;
        const messages = message.split("\n");
        messages.forEach((chunk) => {
          if (chunk === "" || noMore) {
            return;
          }
          try {
            expect(chunk).to.eql(
              `${JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32700, message: "Parse Error" },
                id: null
              })}`
            );
            noMore = true;
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
    it("should send 'invalid request' error if method is not a string", (done) => {
      let message = "";
      let noMore = false;
      socket.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          method: 1,
          params: [],
          id: 69
        })}\n`
      );
      socket.on("data", (data) => {
        message += data;
        const messages = message.split("\n");
        messages.forEach((chunk) => {
          try {
            if (chunk === "" || noMore) {
              return;
            }
            expect(chunk).to.eql(
              `${JSON.stringify({
                jsonrpc: "2.0",
                error: { code: -32600, message: "Invalid Request" },
                id: 69
              })}`
            );
            noMore = true;
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });
  describe("notifications", () => {
    it("should handle client notification", (done) => {
      server.onNotify("notification", (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "notification",
          params: []
        });
        done();
      });
      client.request().notify("notification", []);
    });
    it("should handle batch notifications", (done) => {
      server.onNotify("notify", (message) => {
        expect(message).to.be.eql({
          jsonrpc: "2.0",
          method: "notify",
          params: []
        });
        done();
      });
      client.batch([client.request().message("notify", [], false)]);
    });
  });
  describe("promise methods", () => {
    it("should resolve promise method", (done) => {
      client
        .request()
        .send("promise.resolve", [])
        .then((result) => {
          expect(result).to.be.eql({
            result: ["resolve"],
            jsonrpc: "2.0",
            id: 5
          });
          done();
        });
    });
    it("should reject promise method", (done) => {
      client
        .request()
        .send("promise.reject", [])
        .catch((result) => {
          expect(result).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32603, message: "\"reject\"" },
            id: 6
          });
          done();
        });
    });
  });
});

describe("TCP Server V1", () => {
  before((done) => {
    serverV1.listen().then(() => {
      socketV1.connect(8100, "127.0.0.1", () => {
        done();
      });
    });
  });
  after((done) => {
    serverV1.close().then(() => {
      socketV1.destroy();
      socketV1.on("close", () => {
        done();
      });
    });
  });
  describe("errors", () => {
    it("should send 'invalid request' error if 2.0 request sent to a 1.0 server", (done) => {
      let message = "";
      let noMore = false;
      socketV1.write(
        `${JSON.stringify({
          jsonrpc: "2.0",
          method: "params",
          params: [1, 2],
          id: 99
        })}\n`
      );
      socketV1.on("data", (data) => {
        message += data;
        const messages = message.split("\n");
        messages.forEach((chunk) => {
          try {
            if (chunk === "" || noMore) {
              return;
            }
            expect(chunk).to.eql(
              `${JSON.stringify({
                result: null,
                error: { code: -32600, message: "Invalid Request" },
                id: 99
              })}`
            );
            noMore = true;
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });
  describe("listener events", () => {
    it("should set the factory to stop listening and remove all connected clients", (done) => {
      const server2 = new Jaysonic.server.tcp({ port: 8102 });
      server2.listen().then(() => {
        const client2 = new Jaysonic.client.tcp({
          host: "127.0.0.1",
          port: 8102,
          retries: 0
        });
        client2.connect().then(() => {
          expect(server2.clients).to.have.lengthOf(1);
          server2.close().then(() => {
            expect(server2.listening).to.eql(false);
            expect(server2.clients).to.eql([]);
            client2.end();
            done();
          });
        });
      });
    });
    it("should throw an error if an 'error' event occurs when starting serer", (done) => {
      const server3 = new Jaysonic.server.tcp({ port: 0, host: "1.1.1.1" });
      server3.listen().catch((error) => {
        expect(error).to.be.instanceOf(Error);
        expect(error.code).to.eql("EADDRNOTAVAIL");
        done();
      });
    });
  });
});
