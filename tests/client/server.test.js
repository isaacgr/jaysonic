const client = require("../client");

const Jaysonic = require("../../src");
const expect = require("chai").expect;

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 6969 });

beforeEach(done => {
  client.connect();
  done();
});

after(() => {
  server.close();
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
        done();
      });
    });
    it("should log disconnected clients", done => {
      server.clientDisconnected(conn => {
        expect(conn).to.have.all.keys("host", "port");
        done();
      });
    });
  });
});
