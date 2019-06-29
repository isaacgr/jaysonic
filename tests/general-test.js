const Jaysonic = require("../src");

const server = new Jaysonic.server.tcp();

server.listen().then(() => {
  console.log("listening");
});

server.method("test", () => "hi");
server.method("add", ([a, b]) => a + b);
server.onNotify("notify", () => {
  console.log("notification");
});

const client = new Jaysonic.client.tcp({ port: 8900 });

client.subscribe("notification", (error, message) => {
  if (error) {
    console.log(error);
  }
  console.log(message);
});

client
  .connect()
  .then(() => {
    console.log("connected");

    test();
    add();
    batch();
    badreq();
    batch();
    // error();
    invalid();
    badmeth();
    notify();
    server.notify("notification", []);
  })
  .catch((error) => {
    console.log(`Client Error: ${error}`);
  });

const test = () => {
  client
    .request()
    .send("test", [])
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.log(error);
    });
};
const add = () => {
  client
    .request()
    .send("add", [1, 2])
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.log(error);
    });
};

const error = () => {
  client
    .request()
    .send("test")
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.log(error);
    });
};

const badmeth = () => {
  client
    .request()
    .send("1", [])
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.log(error);
    });
};

const badreq = () => {
  client
    .request()
    .send("add", {})
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.log(error);
    });
};

const batch = () => {
  client
    .batch([
      client.request().message("test", []),
      client.request().message("test", [])
    ])
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.log(error);
    });
};

const invalid = () => {
  client
    .request()
    .send("{}", {})
    .then((result) => {
      console.log(result);
    })
    .catch((error) => {
      console.log(error);
    });
};

const notify = () => {
  client.request().notify("notify", []);
};
