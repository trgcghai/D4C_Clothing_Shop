import { getChannel, DLQ_QUEUE, DLX_EXCHANGE, DLQ_ROUTING_KEY } from "../config/rabbitmq.config.js";
import { processEvent } from "../utils/event-processor.js";

const MAX_RETRIES = 5;

export async function processDLQ() {
  const channel = await getChannel();
  let processed = 0;

  while (true) {
    const msg = await channel.get(DLQ_QUEUE, { noAck: false });

    if (!msg) {
      break;
    }

    try {
      const body = JSON.parse(msg.content.toString());
      const { eventType, data } = body;
      const retryCount = msg.properties.headers?.["x-retry-count"] || 0;

      if (retryCount >= MAX_RETRIES) {
        console.error(
          `DLQ message permanently failed after ${MAX_RETRIES} retries: ${eventType} ${data?.id}`
        );
        channel.ack(msg);
        processed++;
        continue;
      }

      console.log(
        `Retrying DLQ message (attempt ${retryCount + 1}/${MAX_RETRIES}): ${eventType} ${data?.id}`
      );

      await processEvent(eventType, data);
      channel.ack(msg);
      processed++;
    } catch (err) {
      console.error("DLQ retry failed:", err.message);
      const headers = msg.properties.headers || {};
      headers["x-retry-count"] = (headers["x-retry-count"] || 0) + 1;

      channel.publish(DLX_EXCHANGE, DLQ_ROUTING_KEY, msg.content, {
        headers,
        persistent: true,
      });
      channel.ack(msg);
    }
  }

  return { processed };
}
