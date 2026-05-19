import { v4 as uuidv4 } from "uuid";
import { publish, connect } from "../config/rabbitmq.publisher.js";

const ROUTING_KEYS = {
  CREATE: "product.created",
  UPDATE: "product.updated",
  DELETE: "product.deleted",
};

export function publishProductEvent(eventType, productData) {
  const event = {
    eventId: uuidv4(),
    eventType,
    timestamp: new Date().toISOString(),
    data: productData,
  };

  const routingKey = ROUTING_KEYS[eventType];
  if (!routingKey) {
    console.error(`Unknown event type: ${eventType}`);
    return;
  }

  publish(routingKey, event);
}

export { connect as connectEventPublisher };

const CATEGORY_ROUTING_KEYS = {
  CREATE: "category.created",
  UPDATE: "category.updated",
  DELETE: "category.deleted",
};

export function publishCategoryEvent(eventType, categoryData) {
  const event = {
    eventId: uuidv4(),
    eventType: `CATEGORY_${eventType}D`,
    timestamp: new Date().toISOString(),
    data: categoryData,
  };

  const routingKey = CATEGORY_ROUTING_KEYS[eventType];
  if (!routingKey) {
    console.error(`Unknown category event type: ${eventType}`);
    return;
  }

  publish(routingKey, event);
}
