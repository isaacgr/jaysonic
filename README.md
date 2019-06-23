![](logo.png)

# Jaysonic- A persistent JSON-RPC client and server

---

A TCP and HTTP server and client that implement the JSON-RPC 2.0 Specification.

### List of features

- Promise based
- Persistent connections
- Notification subscriptions
- TCP server/client
- HTTP server/client

### Code Demos

#### TCP

##### Methods

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 8100 });
const client = new Jayson.client.tcp({ host: "127.0.0.1", port: 6969 });

server.method("add", ([a, b]) => a + b);

client
  .request("add", [1, 2])
  .then(result => {
    console.log(result);
    // {jsonrpc: "2.0", method: "add", result: 3, id: 1}
  })
  .catch(error => {
    console.log(error);
  });
```

##### Notifications

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 8100 });
const client = new Jayson.client.tcp({ host: "127.0.0.1", port: 6969 });

client.subscribe("notification", message => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notification", params: []}
});
server.notify({
  method: "notification",
  params: []
});
```

### Download & Installation

```shell
$ npm install jaysonic
```

### Contributing

Keep it simple. Keep it minimal. Don't put every single feature just because you can.

### Authors or Acknowledgments

- Isaac Rowell

### License

This project is licensed under the MIT License
