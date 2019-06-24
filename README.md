![](logo.png)

# Jaysonic - A persistent JSON-RPC client and server

---

A TCP and HTTP server and client that implement the JSON-RPC 2.0 Specification.

### List of features

- Promise based
- Persistent connections
- Notification subscriptions
- TCP server/client
- HTTP server/client
- auto increments request id

### Download & Installation

```shell
$ npm install jaysonic
```

### Code Demos

The default host and port for the server is localhost:8100. Based on the node `net.Server()` module.

The client is based on the node `net.Socket()` module.

#### TCP

##### Methods

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 8100 });
const client = new Jayson.client.tcp({ host: "127.0.0.1", port: 8100 });

server.method("add", ([a, b]) => a + b);

client
  .request("add", [1, 2])
  .then((result) => {
    console.log(result);
    // {jsonrpc: "2.0", method: "add", result: 3, id: 1}
  })
  .catch((error) => {
    console.log(error);
  });
```

##### Notifications

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 8100 });
const client = new Jayson.client.tcp({ host: "127.0.0.1", port: 8100 });

client.subscribe("notification", (message) => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notification", params: []}
});
server.notify({
  method: "notification",
  params: []
});
```

#### HTTP

> Note: Notifications are not supported by the HTTP client

##### Methods

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.http({ host: "127.0.0.1", port: 8100 });
const client = new Jayson.client.http({ host: "127.0.0.1", port: 8100 });

server.method("add", ([a, b]) => a + b);

client
  .request("add", [1, 2])
  .then((result) => {
    console.log(result);
    // {jsonrpc: "2.0", method: "add", result: 3, id: 1}
  })
  .catch((error) => {
    console.log(error);
  });
```

### Options

The client and server support changing the JSON-RPC version and the delimiter used. Just pass them in the same object as the host and port to override the defaults.

`host`: The host IP to serve from for the server, or to connect to by the client. Default is `localhost`. \
`port`: The host port to serve from for the server, or to connect to by the client. Default is `8100`. \
`delimiter`: Delimiter to break requests by. Defaults to `\r\n`. \
`version`: RPC version to use. Defaults to `2.0`.

The server has an additional option specified by the [NodeJS Docs](https://nodejs.org/api/net.html#net_server_listen_options_callback).

`exclusive`: If exclusive is false (default), then cluster workers will use the same underlying handle, allowing connection handling duties to be shared. When exclusive is true, the handle is not shared, and attempted port sharing results in an error

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp({
  host: "127.0.0.1",
  port: 8100,
  delimiter: "\n",
  version: 1
});
```

### Contributing

Keep it simple. Keep it minimal. Don't put every single feature just because you can.

### Authors or Acknowledgments

- Isaac Rowell

### License

This project is licensed under the MIT License
