const Jasonic = require("../src");

const client = new Jasonic.client({ host: "172.16.230.4", port: 6969 });

client
  .connect()
  .then(conn => {
    console.log(
      `Client connected to ${client.server.host} on port ${client.server.port}`
    );
  })
  .catch(error => {
    console.log(`${error}`);
  });

client
  .request("get.resources", [])
  .then(res => {
    console.log(res);
  })
  .catch(error => {
    console.log(error);
    client.end();
  });
