const Jaysonic = require("../../src/");

const ws = new Jaysonic.server.ws();

ws.method("get_config", () => "hi");
