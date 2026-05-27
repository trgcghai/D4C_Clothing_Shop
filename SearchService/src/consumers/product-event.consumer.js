import { getChannel, QUEUE } from "../config/rabbitmq.config.js";
import { processEvent } from "../utils/event-processor.js";

export async function startConsumer() {
  const channel = await getChannel();

  channel.consume(QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const body = JSON.parse(msg.content.toString());
      const { eventType, data } = body;

      console.log(`Received event: ${eventType} for product ${data?.id}`);

      await processEvent(eventType, data);
      channel.ack(msg);
    } catch (err) {
      console.error("Error processing product event:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log("Product event consumer started");
}
