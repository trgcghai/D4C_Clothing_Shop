import amqp from "amqplib";

// Dev defaults (guest/guest) are standard for local RabbitMQ.
// Configure RABBITMQ_USER and RABBITMQ_PASSWORD in production.
const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;

export const EXCHANGE = "product.exchange";
export const QUEUE = "search.product.queue";
export const DLX_EXCHANGE = "product.search.dlx";
export const DLQ_QUEUE = "product.search.dlq";
export const DLQ_ROUTING_KEY = "dlq";
export const ROUTING_KEYS = {
  CREATE: "product.created",
  UPDATE: "product.updated",
  DELETE: "product.deleted",
};

export const CATEGORY_QUEUE = "search.category.queue";
export const CATEGORY_DLQ_ROUTING_KEY = "category.failed";
export const CATEGORY_ROUTING_KEYS = {
  CREATE: "category.created",
  UPDATE: "category.updated",
  DELETE: "category.deleted",
};

let connection = null;
let channel = null;

export async function connect() {
  connection = await amqp.connect(RABBITMQ_URL);
  channel = await connection.createChannel();
  await channel.prefetch(10);

  connection.on("error", (err) => {
    console.error("RabbitMQ connection error:", err.message);
    channel = null;
    connection = null;
  });

  connection.on("close", () => {
    console.warn("RabbitMQ connection closed");
    channel = null;
    connection = null;
  });

  // Declare DLX (direct exchange)
  await channel.assertExchange(DLX_EXCHANGE, "direct", { durable: true });

  // Declare DLQ
  await channel.assertQueue(DLQ_QUEUE, {
    durable: true,
    arguments: { "x-queue-type": "quorum" },
  });

  // Bind DLQ to DLX
  await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, DLQ_ROUTING_KEY);
  await channel.bindQueue(DLQ_QUEUE, DLX_EXCHANGE, CATEGORY_DLQ_ROUTING_KEY);

  // Declare main exchange (topic)
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });

  // Declare main queue with DLX
  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-dead-letter-exchange": DLX_EXCHANGE,
      "x-dead-letter-routing-key": DLQ_ROUTING_KEY,
      "x-message-ttl": 300000,
    },
  });

  // Bind queue to exchange with routing keys
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEYS.CREATE);
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEYS.UPDATE);
  await channel.bindQueue(QUEUE, EXCHANGE, ROUTING_KEYS.DELETE);

  await setupCategoryQueue();

  console.log("RabbitMQ connected, exchange and queues declared");
  return { connection, channel };
}

export async function getChannel() {
  if (!channel) {
    await connect();
  }
  return channel;
}

export async function setupCategoryQueue() {
  await channel.assertQueue(CATEGORY_QUEUE, {
    durable: true,
    arguments: {
      "x-queue-type": "quorum",
      "x-dead-letter-exchange": DLX_EXCHANGE,
      "x-dead-letter-routing-key": CATEGORY_DLQ_ROUTING_KEY,
      "x-message-ttl": 300000,
    },
  });

  await channel.bindQueue(CATEGORY_QUEUE, EXCHANGE, CATEGORY_ROUTING_KEYS.CREATE);
  await channel.bindQueue(CATEGORY_QUEUE, EXCHANGE, CATEGORY_ROUTING_KEYS.UPDATE);
  await channel.bindQueue(CATEGORY_QUEUE, EXCHANGE, CATEGORY_ROUTING_KEYS.DELETE);

  console.log("Category queue and bindings declared");
}

export async function close() {
  if (channel) await channel.close();
  if (connection) await connection.close();
}
