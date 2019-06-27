// const Jayson = require("../src");

// const client = new Jayson.client.tcp({
//   host: "172.16.107.117",
//   port: 9102
// });

// client
//   .connect()
//   .then(() => {
//     console.log("connected");
//     getDevices();
//     getConfigs();
//   })
//   .catch((error) => {
//     console.log(`Client Error: ${error}`);
//   });

// const getDevices = () =>
//   client
//     .request()
//     .send("get_devices")
//     .then((result) => {
//       console.log(result);
//     })
//     .catch((error) => {
//       console.log(error);
//     });

// const getConfigs = () =>
//   client
//     .request()
//     .send("get_configs")
//     .then((result) => {
//       console.log(result);
//     })
//     .catch((error) => {
//       console.log(error);
//     });
