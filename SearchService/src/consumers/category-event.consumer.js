import { getChannel, CATEGORY_QUEUE } from "../config/rabbitmq.config.js";
import { processEvent } from "../utils/event-processor.js";

export async function startCategoryConsumer() {
  const channel = await getChannel();

  channel.consume(CATEGORY_QUEUE, async (msg) => {
    if (!msg) return;

    try {
      const body = JSON.parse(msg.content.toString());
      const { eventType, data } = body;

      console.log(`Received category event: ${eventType} for category ${data?.id}`);

      await processEvent(eventType, data);
      channel.ack(msg);
    } catch (err) {
      console.error("Error processing category event:", err.message);
      channel.nack(msg, false, false);
    }
  });

  console.log("Category event consumer started");
}
