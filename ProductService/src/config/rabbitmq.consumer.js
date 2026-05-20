import amqp from "amqplib";

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;
const ORDER_EXCHANGE = "order.exchange";
const ORDER_CANCELLED_ROUTING_KEY = "order.cancelled";
const QUEUE_NAME = "order.cancelled.queue";

let connection = null;
let channel = null;
let reconnectTimer = null;

async function setupChannel() {
  channel = await connection.createChannel();
  await channel.assertExchange(ORDER_EXCHANGE, "topic", { durable: true });
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  await channel.bindQueue(QUEUE_NAME, ORDER_EXCHANGE, ORDER_CANCELLED_ROUTING_KEY);
  console.log("ProductService RabbitMQ consumer channel ready");
}

export async function connectConsumer() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    await setupChannel();

    connection.on("error", (err) => {
      console.error("RabbitMQ consumer connection error:", err.message);
      channel = null;
      scheduleReconnect();
    });

    connection.on("close", () => {
      console.warn("RabbitMQ consumer connection closed, reconnecting...");
      channel = null;
      scheduleReconnect();
    });

    console.log("ProductService RabbitMQ consumer connected");
    return channel;
  } catch (err) {
    console.error("RabbitMQ consumer connection failed:", err.message);
    scheduleReconnect();
    return null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!connection) {
      await connectConsumer();
    }
  }, 5000);
}

export async function consumeOrderCancelled(handler) {
  if (!channel) {
    console.warn("RabbitMQ consumer channel not ready, skipping consume");
    return;
  }
  try {
    await channel.consume(QUEUE_NAME, async (msg) => {
      if (!msg) return;
      try {
        const event = JSON.parse(msg.content.toString());
        await handler(event);
        channel.ack(msg);
      } catch (err) {
        console.error("Failed to process order cancelled event:", err.message);
        channel.nack(msg, false, false);
      }
    });
    console.log("Listening for order.cancelled events on queue:", QUEUE_NAME);
  } catch (err) {
    console.error("Failed to set up order cancelled consumer:", err.message);
  }
}

export async function closeConsumer() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (channel) await channel.close();
  if (connection) await connection.close();
}
