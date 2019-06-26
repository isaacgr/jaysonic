const Jayson = require("../../src");

const server = new Jayson.server.http({ port: 8000 });

server.method("add", ([a, b]) => a + b);

server.method("greeting", ({ name }) => `Hello ${name}`);

server.method("typeerror", ([a]) => {
  if (typeof a !== "string") {
    throw new TypeError();
  }
});

before((done) => {
  server.listen().then(() => {
    done();
  });
});
