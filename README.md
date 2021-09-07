<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Jaysonic - A persistent JSON-RPC client and server](#jaysonic---a-persistent-json-rpc-client-and-server)
  - [List of features](#list-of-features)
  - [Download & Installation](#download--installation)
  - [Class Documentation](#class-documentation)
  - [CLI tool](#cli-tool)
    - [Install](#install)
    - [Usage](#usage)
  - [Use of the library as a standalone module](#use-of-the-library-as-a-standalone-module)
    - [Initialization](#initialization)
      - [WS Client for browser](#ws-client-for-browser)
      - [WS Client for Node](#ws-client-for-node)
    - [Options](#options)
      - [Client and server options](#client-and-server-options)
      - [Client only options](#client-only-options)
      - [Other client and server options](#other-client-and-server-options)
    - [Code Demos](#code-demos)
      - [Initialization](#initialization-1)
        - [TCP](#tcp)
        - [HTTP](#http)
        - [HTTPS](#https)
        - [Websocket](#websocket)
      - [Server side](#server-side)
        - [Instantiation and Listening](#instantiation-and-listening)
        - [Closing the connection](#closing-the-connection)
        - [Adding Methods](#adding-methods)
        - [Listening for client connections](#listening-for-client-connections)
      - [Client Side](#client-side)
        - [Connecting](#connecting)
        - [Listening for server disconnect](#listening-for-server-disconnect)
        - [Ending the connection](#ending-the-connection)
        - [Making requests](#making-requests)
        - [Subscriptions](#subscriptions)
        - [Batch Requests](#batch-requests)
        - [HTTP Client Requests](#http-client-requests)
      - [Notifications](#notifications)
        - [Client](#client)
        - [Server](#server)
        - [Batches](#batches)
      - [HTTP Client Notifications](#http-client-notifications)
  - [Contributing](#contributing)
  - [Authors or Acknowledgments](#authors-or-acknowledgments)
  - [License](#license)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

![](logo.png)

# Jaysonic - A persistent JSON-RPC client and server

| Check                | Status                                                                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Travis CI Build      | [![Build Status](https://travis-ci.com/isaacgr/jaysonic.svg?branch=master)](https://travis-ci.com/isaacgr/jaysonic)                                                     |
| Test Coverage        | [![Coverage Status](https://coveralls.io/repos/github/isaacgr/jaysonic/badge.svg?branch=master)](https://coveralls.io/github/isaacgr/jaysonic?branch=master)            |
| Code Maintainability | [![Maintainability](https://api.codeclimate.com/v1/badges/b061f4e44fa85d5e8b04/maintainability)](https://codeclimate.com/github/isaacgr/jaysonic/maintainability)       |
| Docs Build           | [![Netlify Status](https://api.netlify.com/api/v1/badges/34ec9715-e872-4a37-a53b-7a0207fc57a3/deploy-status)](https://app.netlify.com/sites/keen-sammet-556a43/deploys) |

---

A TCP, HTTP and WebSocket server and client library which implements the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) and [1.0](https://www.jsonrpc.org/specification_v1) specifications. Written for [nodejs](https://nodejs.org/en/), primarily utilizing ES6 syntax.

## List of features

- Promise based
- Persistent connections
- Notification subscriptions
- Batching
- TCP server/client
- HTTP server/client
- WebSocket server/client
- WebSocket client supported in the browser
- Automatic increment of request ID
- Associate response ID with request
- CLI tool for testing/cross-codebase integration

## Download & Installation

```shell
$ npm install jaysonic
```

## Class Documentation

Latest documentation on the methods and classes available in the library

https://jaysonic.irowell.io/

It is recommnded to import and extend these classes if you dont wish to use the library as a standalone module (as described below).

## CLI tool

#### Install

Optionally install the package globally to access from the cli

```bash
npm install -g jaysonic
```

If installed globally

```bash
jaysonic-client --method hello
```

or locally through `node_modules`

```bash
./node_modules/jaysonic/bin/client --method hello
```

#### Usage

```bash
Usage: jaysonic-client --host 192.168.2.1 --port 8555 --method hello --params '["foo"]'

Making requests with multiple methods is supported with comma separated values, i.e.

--method hello,hi
or
--notification goodbye,seeya
or
--subscribe update,anotherupdate

Params can also be comma separated, these should be one-to-one lined up with the method or notification, i.e.

--method request1,request2 --params '["params1"],["params2"]'

Request methods cannot be sent with notifications, however subscriptions can be made along side either, i.e.

--method hello --subscribe some.update
or
--notification bye --subscribe someother.update


Options:
  -V, --version                  output the version number
  -c, --client-type <string>     Type of client (tcp, ws, http, https) (default: "tcp")
  -m, --method <string>          Method name for request. Comma separate method names to do more than one at a time.
  -s, --subscribe <string>       Method name to subscribe to. Comma separate method names to do more than one at a time.
  -n, --notify <string>          Method name for notification. Comma separate method names to do more than one at a time.
  --params <object>              Array or object to use as parameters. Comma separate params list or object to use with multiple request or notification methods.
  -i, --host <string>            Host IP of the server (default: "127.0.0.1")
  -p, --port <number>            Port to connect to
  -u, --path <string>            Path for ws or http client (default: "/")
  --headers <string>             Headers for http request.
  -d, --delimiter <string>       Delimiter to use for the request. For example: Use $'\n' as cli syntax for escape characters. (default: "\n")
  -t, --timeout <number>         Response timeout in seconds (default: 30)
  --connection-timeout <number>  Connection timeout in milliseconds (default: 5000)
  -r, --retries <number>         Number of connection retry attempts (default: 2)
  -v, --jsonrpc-version <type>   JSON-RPC version (1 or 2) (default: 2)
  -w, --write <string>           Write output to file
```

## Use of the library as a standalone module

### Initialization

All clients and servers are instantiated with the same syntax, just change the type

```js
// TCP
const server = new Jaysonic.server.tcp();
const client = new Jaysonic.client.tcp();
// HTTP
const server = new Jaysonic.server.http();
const client = new Jaysonic.client.http();
// WS
const wss = new Jaysonic.server.ws();
```

**Note that there are two web socket clients**\
**One can only be run in the browser, and the other can run in a NodeJS environment.**

#### WS Client for browser

The browser ws client is based on the `window.WebSocket` class.

```js
const Jaysonic = require("jaysonic/lib/client-ws");
const ws = new Jaysonic.wsclient();
```

#### WS Client for Node

The Node ws client is based on the [`ws`](https://github.com/websockets/ws) library (same as the server).

```js
const Jaysonic = require("jaysonic");
const ws = new Jaysonic.client.ws();
```

### Options

The client and server support changing the JSON-RPC version and the delimiter used. Just pass them in the same object as the host and port to override the defaults.

#### Client and server options

`host`: The host IP to serve from for the server, or to connect to by the client. Default is `127.0.0.1`. Note this is only available for the HTTP and TCP server/client. \
`port`: The host port to serve from for the server, or to connect to by the client. Default is `8100`. \
`delimiter`: Delimiter to break requests by. Defaults to `\n`. \
`version`: RPC version to use. Defaults to `2.0`.

#### Client only options

`retries`: The number of retry attempts for the client to connect to the server. Default is `2`. If set to `null` then the client will retry indefinitely.\
`timeout`: The amount of time before a request times out. Will return a `-32000` error code. The default value is `30` (in seconds). \
`connectionTimeout`: The amount of time between connection retry attempts to a server. The default value is `5000` (in milliseconds).

#### Other client and server options

The TCP and HTTP server have an additional option specified by the [NodeJS Docs](https://nodejs.org/api/net.html#net_server_listen_options_callback).

`exclusive`: If exclusive is false (default), then cluster workers will use the same underlying handle, allowing connection handling duties to be shared. When exclusive is true, the handle is not shared, and attempted port sharing results in an error.

The HTTP server has an additional option to select the scheme:

`scheme`: Can be `'http'` or `'https'`

The HTTP client supports additional options for the HTTP request:

`method`: The method to make the request with. Default is `POST`.
`path`: The path to send the request to. Default is `/`.
`encoding`: How to encode the HTTP request. Will factor into content-length calculation. Default is `utf-8`.
`scheme`: Can be `'http'` or `'https'`/
`headers`: Headers to include in the request. Defaults provided by the spec are:

- `"Content-Length"`
  - calculated on a per request basis
- `"Content-Type"`
  - defaults to `"application/json`
- `Accept`
  - defaults to `"application/json"`

The WebSocket client supports an additional option in place of the host property.

`url`: The web socket url to connect to. Default is `ws://127.0.0.1:8100`.

The WebSocket server is based on the ws library (https://github.com/websockets/ws).

It supports all of the options listed in their README. Typically changing the port is enough.

### Code Demos

The default host and port for the server is `127.0.0.1:8100`. Based on the node `net.Server()` module.

The default host and port for the TCP client is `127.0.0.1:8100`. Based on the node `net.Socket()` module.

The default request URL for the HTTP client is `http://127.0.0.1:8100/`. Based on the node `http.ClientRequest` module.

The default url for the WS client is `ws://127.0.0.1:8100`. Based on the `WebSocket` module from JavaScript.

The default port for the WS Server is `8100`. Based on the `ws` library.

The default options will be used when instantiating the client or the server. Overrides can be provided by passing an object with the modifications.

#### Initialization

###### TCP

```js
const Jaysonic = require("jaysonic");

// server with overrides
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

// client with overrides
const client = new Jaysonic.client.http({
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json"
    },
    path: "/"
  };
});

// server

const server = new Jaysonic.server.http()
```

###### HTTPS

Pass `https` to the `sheme` option to use an https client or server.

The https server requires an SSL key and certificate file.

```js
const Jaysonic = require("jaysonic");

// https client
const client = new Jaysonic.client.http({ scheme: "https" });

// https server
const server = new Jaysonic.server.http({
  scheme: "http",
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("server.crt")
});
```

###### Websocket

`wsclient` class can only be used in the browser.
`client.ws` cannot be used in the browser.

```js
const Jaysonic = require("jaysonic");
const socket = require("jaysonic/lib/client-ws");

// client and server with overrides

// client in the browser
const ws = new socket.wsclient({
  url: "ws://127.0.0.1:8100"
});
// or to work in node
const ws = new Jaysonic.client.ws({
  url: "ws://127.0.0.1:8100"
});

const wss = new Jaysonic.server.ws({
  port: 8100
});
```

#### Server side

##### Instantiation and Listening

```js
const Jaysonic = require("jaysonic");

const server = new Jaysonic.server.tcp();

server
  .listen()
  .then(({ host, port }) => {
    console.log(`Server listening on ${host}:${port}`);
  })
  .catch((error) => {
    console.log(`Unable to start server, ${error}`);
  });
```

##### Closing the connection

```js
server
  .close()
  .then(() => {
    // do something
  })
  .catch((error) => {
    // error when trying to close the connection
  });
```

##### Adding Methods

```js
server.method("add", ([a, b]) => a + b);

// can also add named
const add = ([a, b]) => a + b;

server.method("add", add);

// or promises
const add = ([a, b]) =>
  new Promise((resolve, reject) => {
    resolve(a + b);
  });

server.method("add", add);
```

_Note: The same syntax for all the above methods is used for the HTTP and WS server_

##### Listening for client connections

The `clientConnected` and `clientDisconnected` methods return the host and port of the client in the event. These methods are not available for the HTTP server.

```js
server.clientConnected = (client) => {
  console.log("client connected");
};

server.clientDisconnected = (client) => {
  server.removeDisconnectedClient(client); // recommended to call along with clientDisconnected to clean up clients list
  console.log("client disconnected");
};
```

#### Client Side

##### Connecting

```js
const Jaysonic = require("jaysonic");
const client = new Jaysonic.client.tcp();

client
  .connect()
  .then(({ host, port }) => {
    console.log(`Client connected on ${host}:${port}`);
  })
  .catch((error) => {
    console.log(`Client unable to connect, ${error}`);
  });
```

**Note that the HTTP client does not have a connect() method and can just begin making requests to the server.**

##### Listening for server disconnect

The `serverDisconnected` method fires a callback when the server is disconnected.

```js
client.serverDisconnected(() => {
  // do something
});
```

##### Ending the connection

The TCP client accepts an optional callback function to .end()

```js
client.end();
// or
client.end(() => console.log("connection ended"));
```

The websocket clients accept an optional status code and reason for closing per https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close

```js
client.end(1009, "Message too big");
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
    .send("add", [1, 2])
    .then((result) => {
      console.log(result);
      // {jsonrpc: "2.0", result: 3, id: 1}
    })
    .catch((error) => {
      console.log(error);
    });
};
```

##### Subscriptions

Clients can subscribe to notifications from the server.

**Note: Subscriptions are not supported by the HTTP server/client**\

```js
client.subscribe("notification", (message) => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notification", params: []}
});
server.notify([["notification", []]]);
```

**The websocket browser client returns an object with a `detail` key which contains the notification**

```js
wsclient.subscribe("notification", ({ detail }) => {
  console.log(detail);
  // {jsonrpc: "2.0", method: "notification", params: []}
});
wsserver.notify([["notification", []]]);
```

A client can also unsubscribe a method from a notification, or unsubscribe all methods from a notification. This requires the callback function to be named, else it wont be able to remove it.

```js
client.unsubscribe("notification", callback);
client.unsubscribeAll("notification");
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
      client.message("add", [1, 2]),
      client.message("add", [3, 4])
    ])
    .then((result) => {
      // [
      //   {jsonrpc: "2.0", result: 3, id: 1},
      //   {jsonrpc: "2.0", result: 7, id: 2}
      // ]
    })
    .catch((error) => {
      console.log(error);
    });
```

The same syntax is used for the HTTP client

##### HTTP Client Requests

The HTTP Client will include additional information about the response, as per nodes `http.IncomingMessage` method. See more [here](https://nodejs.org/api/http.html#http_class_http_incomingmessage).

The HTTP client response and error are objects with a `body` property, which contains the json response from the server, as well as the `http.IncomingMessage` instance. Which contains things like the header and statusCode. All methods can be found [here](https://www.w3schools.com/nodejs/obj_http_incomingmessage.asp).

Additionally, the `error` object contains a `response` property that provides the body of the erroneous response.

```js
client
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

#### Notifications

##### Client

Clients can send notifications to the server.

The server can also listen for all notifications not tied to methods and handle accordingly.

**Note as of v2.0.0 server.onNotify no longer returns an error as the fist parameter to the callback**

```js
// optionally returns a promise indicating success or failure for sending message
client.notify("notify", []);

server.onNotify("notify", (message) => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notify", params: []}
});
```

A server can also unsubscribe a method from a notification, or unsubscribe all methods from a notification. This requires the callback function to be named, else it wont be able to remove it.

```js
server.unsubscribeOnNotify("notification", callback);
server.unsubscribeAllOnNotify("notification");
```

##### Server

The server can send notifications to the client. This can be done individually or in a batch.

**Note: As of v2.0.0 notifications from the server are sent as a list of lists, instead of just supplying the method and params. This was done to handle batch notifications.**

`server.notify` will return a list of error objects if there was a problem sending the notification out to any client, or if no clients are connected. The error of one client will not affect the notification being sent out to the rest of the clients.

```js
// optionally returns a promise indicating success or failure for sending message
client.subscribe("notify", callback);

// send a single notification
server.notify([["notify", []]]);

// send a batch of notifications
server.notify([
  ["notify", []],
  ["test", [1, 2, 3]]
]);
```

As of v2.0.0, notifications sent and recieved in batches are now supported

##### Batches

```js
// send from the client by setting the 3rd parameter in the request().message() method to false
client.batch([client.message("test", [], false)]);

// send from server by providing a list of arrays containing
// a method and optional params value
server.notify([["notification", ["a", 1]], ["browser"]]);
```

As per the JSON-RPC spec for HTTP, a notification response must include a `204` status code, with an empty response body. The HTTP Client will resolve a response object if it receives this response, and reject it otherwise.

#### HTTP Client Notifications

```js
// optionally returns a promise indicating success or failure for sending message
client
  .notify("notify", [])
  .then((response) => {
    console.log(response.statusCode);
    // 204
  })
  .catch((error) => {
    console.log(error);
  });

server.onNotify("notify", (message) => {
  console.log(message);
  // {jsonrpc: "2.0", method: "notify", params: []}
});
```

## Contributing

Definitely welcome. I tried to account for everything in the spec, but issues come up of course.

Keep it simple. Keep it minimal. Make sure all tests pass and no linting errors.

## Authors or Acknowledgments

- Isaac Rowell

## License

This project is licensed under the MIT License
