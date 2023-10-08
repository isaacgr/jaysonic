const { expect } = require("chai");
const Jaysonic = require("../../src");
const { server, serverHttp, wss } = require("../test-server");

const tcpclient = new Jaysonic.client.tcp();
const httpclient = new Jaysonic.client.http({
  headers: {
    Connection: "close"
  }
});
const wsclient = new Jaysonic.client.ws();

const noParams = () => "success";

server.method("no.params", noParams);
serverHttp.method("no.params", noParams);
wss.method("no.params", noParams);

describe("#51 Empty params", () => {
  describe("server", () => {
    describe("tcp", () => {
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
      it("should handle calling method when no params in request", (done) => {
        tcpclient.connect().then(() => {
          tcpclient
            .request()
            .send("no.params")
            .then((result) => {
              expect(result).to.be.eql({
                result: "success",
                jsonrpc: "2.0",
                id: 1
              });
              done();
            });
        });
      });
    });
    describe("http", () => {
      before((done) => {
        serverHttp.listen().then(() => {
          done();
        });
      });
      after((done) => {
        serverHttp.close().then(() => {
          done();
        });
      });
      it("should handle calling method when no params in request", (done) => {
        httpclient
          .request()
          .send("no.params")
          .then((result) => {
            expect(result.body).to.be.eql({
              result: "success",
              jsonrpc: "2.0",
              id: 1
            });
            done();
          });
      });
    });
    describe("wss", () => {
      before((done) => {
        wss.listen().then(() => {
          done();
        });
      });
      after((done) => {
        wss.close().then(() => {
          done();
        });
      });
      it("should handle calling method when no params in request", (done) => {
        wsclient.connect().then(() => {
          wsclient
            .request()
            .send("no.params")
            .then((result) => {
              expect(result).to.be.eql({
                result: "success",
                jsonrpc: "2.0",
                id: 1
              });
              done();
            });
        });
      });
    });
  });
});
