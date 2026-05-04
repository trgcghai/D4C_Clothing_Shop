import { Eureka } from "eureka-js-client";

const eurekaClient = new Eureka({
  instance: {
    app: "ProductService",
    instanceId: `ProductService:${process.env.PORT || 8082}`,
    hostName: "localhost",
    ipAddr: "127.0.0.1",

    statusPageUrl: `http://localhost:${process.env.PORT}/health`,
    healthCheckUrl: `http://localhost:${process.env.PORT}/health`,

    port: {
      $: process.env.PORT,
      "@enabled": true,
    },

    vipAddress: "ProductService",
    dataCenterInfo: {
      "@class": "com.netflix.appinfo.InstanceInfo$DefaultDataCenterInfo",
      name: "MyOwn",
    },
  },

  eureka: {
    host: "localhost",
    port: 8761,
    servicePath: "/eureka/apps/",
  },
});

export default eurekaClient;
