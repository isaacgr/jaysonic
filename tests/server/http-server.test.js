const { expect } = require("chai");
const chai = require("chai");
const chaiHttp = require("chai-http");
const Jaysonic = require("../../src");
const { clienthttp } = require("../test-client");
const { serverHttp, serverHttpV1 } = require("../test-server");

chai.use(chaiHttp);

const httpRequest = chai.request("http://localhost:8100");

describe("Http Server", () => {
  after((done) => {
    serverHttp.close().then(() => {
      done();
    });
  });
  describe("connection", () => {
    it("should listen for requests", (done) => {
      const conn = serverHttp.listen();
      conn.then((result) => {
        expect(result).to.be.eql({
          host: "127.0.0.1",
          port: 8100
        });
        done();
      });
    });
    it("should return 'Unknown client' from clientDisconnected if client was not found", (done) => {
      let res;
      serverHttp.clientDisconnected = (client) => {
        res = serverHttp._removeFromArray(client, serverHttp.clients);
      };
      serverHttp.clientDisconnected({});
      try {
        expect(res).to.be.eql({ error: "Unable to remove {}" });
        done();
      } catch (e) {
        console.log(e);
        done(e);
      }
    });
    it("should be unable to listen multiple times", (done) => {
      const conn = serverHttp.listen();
      conn.catch((error) => {
        expect(error.message).to.be.a("string");
        done();
      });
    });
    it("should handle requests from multiple clients", (done) => {
      const client1 = new Jaysonic.client.http({
        port: 8100,
        headers: {
          Connection: "close"
        }
      });
      const client2 = new Jaysonic.client.http({
        port: 8100,
        headers: {
          Connection: "close"
        }
      });
      const req1 = client1.request().send("params", [1, 2]);
      const req2 = client2.request().send("named.params", { name: "jaysonic" });
      Promise.all([req1, req2]).then((results) => {
        const [res1, res2] = results;
        expect(res1.body).to.eql({
          jsonrpc: "2.0",
          result: 3,
          id: 1
        });
        expect(res2.body).to.eql({
          jsonrpc: "2.0",
          result: "Hello jaysonic",
          id: 1
        });
        done();
      });
    });
  });
  describe("requests", () => {
    it("should hanlde call with positional params", (done) => {
      const request = clienthttp.request().send("params", [1, 2]);
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: 3,
          jsonrpc: "2.0",
          id: 1
        });
        done();
      });
    });
    it("should handle call with named params", (done) => {
      const request = clienthttp
        .request()
        .send("named.params", { name: "jaysonic" });
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: "Hello jaysonic",
          jsonrpc: "2.0",
          id: 2
        });
        done();
      });
    });
    it("should respond with 'invalid params' error", (done) => {
      const request = clienthttp.request().send("params", {});
      request.catch((response) => {
        expect(response.body).to.be.eql({
          jsonrpc: "2.0",
          error: {
            code: -32602,
            message: "Invalid Parameters"
          },
          id: 3
        });
        done();
      });
    });
    it("should respond with 'method not found' error", (done) => {
      const request = clienthttp.request().send("foo", {});
      request.catch((response) => {
        expect(response.body).to.be.eql({
          jsonrpc: "2.0",
          error: {
            code: -32601,
            message: "Method not found"
          },
          id: 4
        });
        done();
      });
    });
    it("should respond with 'parse error'", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send("{]\n")
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse Error" },
            id: null
          });
          done();
        });
    });
    it("should respond with 'invalid request' error", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send(
          `${JSON.stringify({
            jsonrpc: "2.0",
            method: 1,
            params: [],
            id: 69
          })}\n`
        )
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Invalid Request" },
            id: 69
          });
          done();
        });
    });
    it("should receive 'invalid request' error for non empty array", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send("[1]\n")
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql([
            {
              jsonrpc: "2.0",
              error: { code: -32600, message: "Invalid Request" },
              id: null
            }
          ]);
          done();
        });
    });
  });
  describe("notifications", () => {
    it("should send a '204' response for a notification", (done) => {
      const request = clienthttp.request().notify("notify", []);
      request.then((response) => {
        expect(response.statusCode).to.be.equal(204);
        done();
      });
    });
  });
});
describe("listener events", () => {
  it("should throw an error if an 'error' event occurs when starting serer", (done) => {
    const server = new Jaysonic.server.http({ port: 0, host: "1.1.1.1" });
    server.listen().catch((error) => {
      expect(error).to.be.instanceOf(Error);
      expect(error.code).to.eql("EADDRNOTAVAIL");
      done();
    });
  });
});
describe("Http Server V1", () => {
  before((done) => {
    serverHttpV1.listen().then(() => {
      done();
    });
  });
  after((done) => {
    serverHttpV1.close().then(() => {
      done();
    });
  });
  describe("v1.0 responses", () => {
    it("should provide a v1.0 response to a 1.0 request", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send(
          `${JSON.stringify({
            method: "params",
            params: [1, 2],
            id: 80
          })}\n`
        )
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            result: 3,
            error: null,
            id: 80
          });
          done();
        });
    });
    it("should provide a v1.0 error response to a 1.0 request", (done) => {
      httpRequest
        .post("/")
        .set("Content-Type", "application/json")
        .send(
          `${JSON.stringify({
            method: "foo",
            params: [],
            id: 81
          })}\n`
        )
        .end((error, response) => {
          expect(JSON.parse(response.text)).to.be.eql({
            result: null,
            error: {
              code: -32601,
              message: "Method not found"
            },
            id: 81
          });
          done();
        });
    });
  });
});
