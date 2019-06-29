![](logo.png)

# Jaysonic - A persistent JSON-RPC client and server

---

A TCP and HTTP server and client that implement the JSON-RPC 2.0 Specification.

### List of features

- Promise based
- Persistent connections
- Notification subscriptions
- Batching
- TCP server/client
- HTTP server/client
- Automatic increment of request ID
- Associate response ID with request

### Download & Installation

```shell
$ npm install jaysonic
```

### Initialization

All clients and servers are instantiated with the same syntax, just change the type

```js
// TCP
const server = new Jaysonic.server.tcp();
const client = new Jaysonic.client.tcp();
// HTTP
const server = new Jaysonic.server.http();
const client = new Jaysonic.client.http();
```

### Options

The client and server support changing the JSON-RPC version and the delimiter used. Just pass them in the same object as the host and port to override the defaults.

`host`: The host IP to serve from for the server, or to connect to by the client. Default is `127.0.0.1`. \
`port`: The host port to serve from for the server, or to connect to by the client. Default is `8100`. \
`delimiter`: Delimiter to break requests by. Defaults to `\n`. \
`version`: RPC version to use. Defaults to `2.0`. \
`retries`: The number of retry attempts for the client to connect to the server. Default is `2`. \
`timeout`: The amount of time before a request times out. Will return a `-32000` error code. The default value is `30` (in seconds).

The server has an additional option specified by the [NodeJS Docs](https://nodejs.org/api/net.html#net_server_listen_options_callback).

`exclusive`: If exclusive is false (default), then cluster workers will use the same underlying handle, allowing connection handling duties to be shared. When exclusive is true, the handle is not shared, and attempted port sharing results in an error.

The HTTP client supports additional options for the HTTP request.

`method`: The method to make the request with. Default is `POST`.
`path`: The path to send the request to. Default is `/`.
`headers`: Headers to include in the request. Defaults provided by the spec are:

- `"Content-Length"`
  - calculated by request message, this is not configurable
- `"Content-Type"`
  - defaults to `"application/json; charset=utf-8"`
- `Accept`
  - defaults to `"application/json"`

### Code Demos

The default host and port for the server is `127.0.0.1:8100`. Based on the node `net.Server()` module.

The default host and port for the TCP client is `127.0.0.1:8100`. Based on the node `net.Socket()` module.

The default host and port for the HTTP client is `http://127.0.0.1:80/`. Based on the node `http.ClientRequest` module.

The default options will be used when instantiating the client or the server. Overrides can be provided by passing an object with the modifications.

###### TCP

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp({
  host: "127.0.0.1",
  port: 8100,
  delimiter: "\n",
  version: 1
});
```

###### HTTP

```js
const Jaysonic = require("jaysonic");

const client = new Jaysonic.client.http({
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json"
    },
    path: "/"
  };
});
```

#### Server side

##### Listening

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp({ host: "127.0.0.1", port: 8100 });

server
  .listen()
  .then(({ host, port }) => {
    console.log(`Server listening on ${host}:${port}`);
  })
  .catch((error) => {
    console.log(`Unable to start server, ${error}`);
  });
```

##### Adding Methods

```js
server.method("add", ([a, b]) => a + b);

// can also add named
const add = ([a, b]) => a + b;

server.method("add", add);
```

> The same syntax is used for the HTTP server

#### Client Side

##### Connecting

```js
const Jaysonic = require("jaysonic");
const client = new Jaysonic.client.tcp({ host: "127.0.0.1", port: 8100 });

client
  .connect()
  .then(({ host, port }) => {
    console.log(`Client connected on ${host}:${port}`);
  })
  .catch((error) => {
    console.log(`Client unable to connect, ${error}`);
  });
```

##### Making requests

Requests can only be made once connection is established.

```js
client
  .connect()
  .then(({ host, port }) => {
    add();
  })
  .catch((error) => {
    console.log(`Client unable to connect, ${error}`);
  });

const add = () => {
  client
    .request()
    .send("add", [1, 2])
    .then((result) => {
      console.log(result);
      // 3
    })
    .catch((error) => {
      console.log(error);
    });
};
```

##### Subscriptions

Clients can subscribe to notifications from the server.

**Note: Subscriptions are not supported by the HTTP server/client**

```js
client.subscribe("notification", (error, message) => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notification", params: []}
});
server.notify({
  method: "notification",
  params: []
});
```

##### Batch Requests

```js
client
  .connect()
  .then(({ host, port }) => {
    add();
  })
  .catch((error) => {
    console.log(`Client unable to connect, ${error}`);
  });

const add = () =>
  client
    .batch([
      // access the message object on the request
      client.request().message("add", [1, 2]),
      client.request().message("add", [3, 4])
    ])
    .then((result) => {
      // [
      //   {jsonrpc: "2.0", method: "add", result: 3, id: 1},
      //   {jsonrpc: "2.0", method: "add", result: 7, id: 1}
      // ]
    })
    .catch((error) => {
      console.log(error);
    });
```

The same syntax is used for the HTTP client

The HTTP Client will include additional information about the response, as per nodes `http.IncomingMessage` method. See more [here](https://nodejs.org/api/http.html#http_class_http_incomingmessage).

The HTTP client response is an object with a `body` property, which contains the json response from the server, as well as the `http.IncomingMessage` instance. Which contains things like the header and statusCode. All methods can be found [here](https://www.w3schools.com/nodejs/obj_http_incomingmessage.asp).

##### HTTP Client Requests

```js
client
  .request()
  .send("add", [1, 2])
  .then((result) => {
    console.log(result.body);
    // 3
    console.log(result.statusCode);
    // 200
  })
  .catch((error) => {
    console.log(error);
  });
```

##### Notifications

Clients can send notifications to the server.

The server can also listen for all notifications not tied to methods and handle accordingly.

```js
// optionally returns a promise indicating success or failure for sending message
client.request().notify("notify", []);

server.onNotify("notify", (error, message) => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notify", params: []}
});
```

As per the JSON-RPC spec for HTTP, a notification response must include a `204` status code, with an empty response body. The HTTP Client will resolve a response object if it receives this response, and reject it otherwise.

##### HTTP Client Notifications

```js
// optionally returns a promise indicating success or failure for sending message
client
  .request()
  .notify("notify", [])
  .then((response) => {
    console.log(response.statusCode);
    // 204
  })
  .catch((error) => {
    console.log(error);
  });

server.onNotify("notify", (error, message) => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notify", params: []}
});
```

### Contributing

Definitely welcome. I tried to account for everything in the spec, but issues come up of course.

Keep it simple. Keep it minimal. Make sure all tests pass and no linting errors.

### Authors or Acknowledgments

- Isaac Rowell

### License

This project is licensed under the MIT License
