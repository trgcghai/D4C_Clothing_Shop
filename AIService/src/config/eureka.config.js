import Eureka from "eureka-js-client";
import dotenv from "dotenv";

dotenv.config();

const port = process.env.PORT || 8086;
const ipAddr = process.env.EUREKA_IP || "127.0.0.1";

const eurekaClient = new Eureka.Eureka({
  instance: {
    app: process.env.EUREKA_SERVICE_NAME || "aiservice",
    hostName: ipAddr,
    ipAddr: ipAddr,
    port: {
      $: port,
      "@enabled": "true",
    },
    vipAddress: process.env.EUREKA_SERVICE_NAME || "aiservice",
    dataCenterInfo: {
      "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo",
      name: "MyOwn",
    },
  },
  eureka: {
    host: process.env.EUREKA_HOST || "localhost",
    port: process.env.EUREKA_PORT || 8761,
    servicePath: "/eureka/apps/",
  },
});

export default eurekaClient;
