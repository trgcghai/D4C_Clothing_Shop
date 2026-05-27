import amqp from "amqplib";

const RABBITMQ_URL = `amqp://${process.env.RABBITMQ_USER || "guest"}:${process.env.RABBITMQ_PASSWORD || "guest"}@${process.env.RABBITMQ_HOST || "localhost"}:${process.env.RABBITMQ_PORT || 5672}`;
const EXCHANGE = "product.exchange";

let connection = null;
let channel = null;
let reconnectTimer = null;

async function setupChannel() {
  channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  console.log("ProductService RabbitMQ publisher channel ready");
}

export async function connect() {
  try {
    connection = await amqp.connect(RABBITMQ_URL);
    await setupChannel();

    connection.on("error", (err) => {
      console.error("RabbitMQ connection error:", err.message);
      channel = null;
      scheduleReconnect();
    });

    connection.on("close", () => {
      console.warn("RabbitMQ connection closed, reconnecting...");
      channel = null;
      scheduleReconnect();
    });

    console.log("ProductService RabbitMQ publisher connected");
    return channel;
  } catch (err) {
    console.error("RabbitMQ publisher connection failed:", err.message);
    scheduleReconnect();
    return null;
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!connection) {
      await connect();
    }
  }, 5000);
}

export async function publish(routingKey, message) {
  if (!channel) {
    console.warn("RabbitMQ channel not ready, skipping publish");
    return;
  }
  try {
    channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), {
      persistent: true,
      messageId: message.eventId,
      contentType: "application/json",
    });
  } catch (err) {
    console.error("Failed to publish message:", err.message);
  }
}

export async function close() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (channel) await channel.close();
  if (connection) await connection.close();
}
