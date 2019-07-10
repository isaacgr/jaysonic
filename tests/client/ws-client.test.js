const { expect } = require("chai");
const { wss } = require("../test-server.js");

const WSClient = require("../../src/client/ws");

before((done) => {
  wss.listen().then(() => {
    done();
  });
});

describe("WebSocket Client", () => {
  describe("connection", () => {
    it("should connect to server", (done) => {
      const ws = new WSClient();
      ws.onConnection().then(() => {
        done();
      });
    });
  });
});
