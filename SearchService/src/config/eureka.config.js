import { Eureka } from "eureka-js-client";

const SERVICE_NAME = process.env.SERVICE_NAME || "SEARCHSERVICE";
const SERVICE_HOST = process.env.SERVICE_HOST || "localhost";
const SERVICE_IP = process.env.SERVICE_IP || "127.0.0.1";
const SERVICE_PORT = Number(process.env.PORT) || 8089;
const EUREKA_HOST = process.env.EUREKA_HOST || "localhost";
const EUREKA_PORT = Number(process.env.EUREKA_PORT) || 8761;
const EUREKA_SERVICE_PATH = process.env.EUREKA_SERVICE_PATH || "/eureka/apps/";

const eurekaClient = new Eureka({
  instance: {
    app: SERVICE_NAME,
    instanceId: `${SERVICE_NAME}:${SERVICE_HOST}:${SERVICE_PORT}`,
    hostName: SERVICE_HOST,
    ipAddr: SERVICE_IP,
    statusPageUrl: `http://${SERVICE_HOST}:${SERVICE_PORT}/health`,
    healthCheckUrl: `http://${SERVICE_HOST}:${SERVICE_PORT}/health`,
    port: {
      $: SERVICE_PORT,
      "@enabled": true,
    },
    vipAddress: SERVICE_NAME,
    dataCenterInfo: {
      "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo",
      name: "MyOwn",
    },
  },
  eureka: {
    host: EUREKA_HOST,
    port: EUREKA_PORT,
    servicePath: EUREKA_SERVICE_PATH,
  },
});

export default eurekaClient;
