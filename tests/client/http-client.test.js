const { expect } = require("chai");
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
    it("should receive a '204' response for a notification", (done) => {
      const request = clienthttp.request().notify("notify", []);
      request.then((response) => {
        expect(response.statusCode).to.be.equal(204);
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
    it("should receive response for batch request", (done) => {
      const request = clienthttp.batch([
        clienthttp.request().message("add", [1, 2]),
        clienthttp.request().message("add", [3, 4])
      ]);
      request.then((response) => {
        expect(response).to.eql([
          { result: 3, jsonrpc: "2.0", id: 5 },
          { result: 7, jsonrpc: "2.0", id: 6 }
        ]);
        done();
      });
    });
    it("should get a response for large dataset", (done) => {
      const request = clienthttp.request().send("large.data", []);
      request.then((response) => {
        expect(response.body).to.be.eql({
          result: data,
          jsonrpc: "2.0",
          id: 7
        });
        done();
      });
    });
    it("should receive error in batch response if one batch request is bad", (done) => {
      const request = clienthttp.batch([
        clienthttp.request().message("nonexistent", [1, 2]),
        clienthttp.request().message("add", [3, 4])
      ]);
      request.then((response) => {
        expect(response).to.eql([
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
          error: { code: -32700, message: "Parse Error" },
          id: 1
        });
        expect(error.response.headers).to.include({
          "Content-Length": String(length)
        });
        done();
      });
    });
  });
});
