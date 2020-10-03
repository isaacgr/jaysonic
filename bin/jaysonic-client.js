#!/usr/bin/env node

const package = require("../package.json");
const jaysonic = require("..");
const program = require("commander");

// initialize program and define arguments
program
  .version(package.version)
  .option("--client-type <string>", "Type of client (tcp, ws, http)", String)
  .option("--method <string>", "Method name for request", String)
  .option(
    "--params <object>",
    "Array or object to use as parameters",
    JSON.parse
  )
  .option("--host <string>", "Host IP of the server", "127.0.0.1", String)
  .option("--delimiter <string>", "Delimiter to use for the request", "\n")
  .option("--timeout <number>", "Response timeout in seconds", 30, Number)
  .option(
    "--connection-timeout <number>",
    "Connection timeout in seconds",
    5,
    Number
  )
  .option("--port <number>", "Port to connect to", Number)
  .option(
    "--retries <number>",
    "Number of connection retry attempts",
    2,
    Number
  )
  .option("--jsonrpc-version <type>", "JSON-RPC version (1 or '2.0')", "2.0")
  .parse(process.argv);
