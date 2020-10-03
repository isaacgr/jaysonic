#!/usr/bin/env node

const package = require("../package.json");
const Jaysonic = require("..");
const program = require("commander");
const fs = require("fs");

program
  .version(package.version)
  .option(
    "--client-type <string>",
    "Type of client (tcp, ws, http)",
    "tcp",
    String
  )
  .requiredOption("--method <string>", "Method name for request", String)
  .option(
    "--params <object>",
    "Array or object to use as parameters",
    JSON.parse
  )
  .option("--host <string>", "Host IP of the server", "127.0.0.1", String)
  .option("--port <number>", "Port to connect to", Number)
  .option("--path <string>", "Path for ws or http client", "/", String)
  .option("--delimiter <string>", "Delimiter to use for the request", "\n")
  .option("--timeout <number>", "Response timeout in seconds", 30, Number)
  .option(
    "--connection-timeout <number>",
    "Connection timeout in seconds",
    5,
    Number
  )
  .option(
    "--retries <number>",
    "Number of connection retry attempts",
    2,
    Number
  )
  .option("--jsonrpc-version <type>", "JSON-RPC version (1 or '2.0')", "2.0")
  .option("--write <string>", "Write output to file", String)
  .parse(process.argv);

const getClient = () => {
  let client;
  if (program.clientType === "ws") {
    const options = {
      url: `ws://${program.host}:${program.port}${program.path}`
    };
    client = new Jaysonic.client.ws({
      ...program.options,
      ...options
    });
  } else if (program.clientType === "http") {
    const options = {
      host: program.host,
      port: program.port,
      path: program.path
    };
    client = new Jaysonic.client.http({
      ...program.options,
      ...options
    });
  } else if (program.clientType === "tcp") {
    const options = { host: program.host, port: program.port };
    client = new Jaysonic.client.tcp({
      ...program.options,
      ...options
    });
  }
  return client;
};

const client = getClient();

client
  .connect()
  .then(() => {
    client
      .request()
      .send(program.method, program.params)
      .then((result) => {
        if (program.write) {
          fs.writeFileSync(program.write, JSON.stringify(result));
        } else {
          console.log(result);
        }
        process.exit(0);
      })
      .catch((error) => {
        if (program.write) {
          fs.writeFileSync(program.write, JSON.stringify(error));
        } else {
          console.error(error);
        }
        process.exit(error.error.code);
      });
  })
  .catch((error) => {
    console.error(error);
  });
