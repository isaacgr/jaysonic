const { expect } = require("chai");
const http = require("http");
const Jaysonic = require("../../src");
const data = require("../large-data.json");
const { serverHttp } = require("../test-server");

const clienthttp = new Jaysonic.client.http({ port: 8800 });
const httpbinclient = new Jaysonic.client.http({
  host: "httpbin.org",
  method: "GET",
  path: "/headers",
  port: 80
});

before((done) => {
  serverHttp.listen().then(() => {
    done();
  });
});

describe("HTTP Client", () => {
  describe("connection", () => {
    it("should receive error trying to write while disconnected", (done) => {
      const badClient = new Jaysonic.client.http({
        host: "127.0.0.1",
        port: 8101,
        retries: 0
      });
      badClient
        .request()
        .send("add", [1, 2])
        .catch((error) => {
          expect(error).to.be.instanceOf(Error);
          done();
        });
    });
  });
  describe("requests", () => {
    it("should get a response for positional params", (done) => {
      const request = clienthttp.request().send("add", [1, 2]);
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: 3,
          jsonrpc: "2.0",
          id: 1
        });
        done();
      });
    });
    it("should get a response for named params", (done) => {
      const request = clienthttp.request().send("greeting", { name: "Isaac" });
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: "Hello Isaac",
          jsonrpc: "2.0",
          id: 2
        });
        done();
      });
    });
    it("should get an 'invalid params' error", (done) => {
      const request = clienthttp.request().send("add", {});
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
    it("should get a 'method not found' error", (done) => {
      const request = clienthttp.request().send("nonexistent", {});
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
    it("should get a response for large dataset", (done) => {
      const request = clienthttp.request().send("large.data", []);
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: data,
          jsonrpc: "2.0",
          id: 5
        });
        done();
      });
    });
  });
  describe("batches", () => {
    it("should receive response for batch request", (done) => {
      const request = clienthttp.batch([
        clienthttp.request().message("add", [1, 2]),
        clienthttp.request().message("add", [3, 4])
      ]);
      request.then((response) => {
        expect(response.body).to.eql([
          { result: 3, jsonrpc: "2.0", id: 6 },
          { result: 7, jsonrpc: "2.0", id: 7 }
        ]);
        done();
      });
    });
    it("should receive error in batch response if one batch request is bad", (done) => {
      const request = clienthttp.batch([
        clienthttp.request().message("nonexistent", [1, 2]),
        clienthttp.request().message("add", [3, 4])
      ]);
      request.catch((response) => {
        expect(response.body).to.eql([
          {
            jsonrpc: "2.0",
            error: { code: -32601, message: "Method not found" },
            id: 8
          },
          { result: 7, jsonrpc: "2.0", id: 9 }
        ]);
        done();
      });
    });
    it("should reject message with error when parse error thrown with pending call", (done) => {
      const server1 = new http.Server();
      server1.listen({ host: "127.0.0.1", port: 9900 });
      server1.on("request", (request, response) => {
        request.on("data", () => {
          // dont care
        });
        request.on("end", () => {
          response.writeHead(200, { "Content-Type": "application/json" });
          response.write("should get a parse error\n", () => {
            response.end();
          });
        });
      });
      const httpclient = new Jaysonic.client.http({
        host: "127.0.0.1",
        port: 9900
      });
      httpclient
        .request()
        .send("add", [1, 2])
        .catch((error) => {
          expect(error.body).to.be.eql({
            jsonrpc: "2.0",
            error: {
              code: -32700,
              message: "Unable to parse message: 'should get a parse error'"
            },
            id: 1
          });
          done();
        });
    });
  });
  describe("multiple requests", () => {
    it("should get responses for multiple requests at once", (done) => {
      const request = clienthttp.request().send("add", [1, 2]);
      const request2 = clienthttp.request().send("greeting", { name: "Isaac" });
      const request3 = clienthttp.batch([
        clienthttp.request().message("add", [1, 2]),
        clienthttp.request().message("add", [3, 4])
      ]);
      const request4 = clienthttp.batch([
        clienthttp.request().message("nonexistent", [1, 2]),
        clienthttp.request().message("add", [3, 4])
      ]);
      try {
        request.then((res1) => {
          expect(res1.body).to.eql({ jsonrpc: "2.0", result: 3, id: 10 });
        });
        request2.then((res2) => {
          expect(res2.body).to.eql({
            jsonrpc: "2.0",
            result: "Hello Isaac",
            id: 11
          });
        });
        request3.then((res3) => {
          expect(res3.body).to.eql([
            { result: 3, jsonrpc: "2.0", id: 12 },
            { result: 7, jsonrpc: "2.0", id: 13 }
          ]);
        });
        request4.catch((res4) => {
          expect(res4.body).to.eql([
            {
              jsonrpc: "2.0",
              error: { code: -32601, message: "Method not found" },
              id: 14
            },
            { result: 7, jsonrpc: "2.0", id: 15 }
          ]);
        });
        done();
      } catch (e) {
        done(e);
      }
    });
  });
  describe("notifications", () => {
    it("should receive a '204' response for a notification", (done) => {
      const request = clienthttp.request().notify("notify", []);
      request.then((response) => {
        expect(response.statusCode).to.be.equal(204);
        done();
      });
    });
  });
  describe("headers", () => {
    it("should send headers with content length", (done) => {
      const request = httpbinclient.request().send("add", [1, 2]);
      const length = Buffer.byteLength(
        httpbinclient.request().message("add", [1, 2]),
        httpbinclient.options.encoding
      );
      request.catch((error) => {
        expect(error.body).to.be.eql({
          jsonrpc: "2.0",
          error: { code: -32700, message: "Unable to parse message: '{'" },
          id: 1
        });
        expect(JSON.parse(error.response).headers).to.include({
          "Content-Length": String(length)
        });
        done();
      });
    });
  });
});
