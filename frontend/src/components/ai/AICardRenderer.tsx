import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ProductListCard from "./cards/ProductListCard";
import ProductDetailCard from "./cards/ProductDetailCard";
import CartSummaryCard from "./cards/CartSummaryCard";
import AdminStatsCard from "./cards/AdminStatsCard";
import InventoryReportCard from "./cards/InventoryReportCard";
import ActionResultCard from "./cards/ActionResultCard";
import NotificationListCard from "./cards/NotificationListCard";

// ─── Inline prop-shape types (mirrors each card's interface) ─────────────────

interface ProductItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  brand?: string;
}

interface ProductDetailShape {
  id: string;
  name: string;
  price: number;
  description?: string;
  variants?: unknown[];
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

interface AdminStatsData {
  revenue?: number;
  orders?: number;
  period?: string;
  totalRevenue?: number;
  ordersCount?: number;
}

interface InventoryData {
  threshold: number;
  count: number;
  items: {
    productName: string;
    size: string;
    color: string;
    currentStock: number;
  }[];
}

interface ActionResultData {
  success: boolean;
  message: string;
  productId?: string;
}

// ─── Part types ──────────────────────────────────────────────────────────────

type TextPart = { type: "text"; content: string };
type UIPart   = { type: "ui";   uiType: string; data: Record<string, unknown> };
type Part     = TextPart | UIPart;

// ─── Bracket-counting JSON parser ────────────────────────────────────────────
/**
 * Parses AI text that may contain [UI:TYPE:{...}] blocks.
 * Uses brace-depth counting so nested objects/arrays are handled correctly.
 */
function parseAIContent(content: string): Part[] {
  const parts: Part[] = [];
  let i = 0;
  let textStart = 0;

  while (i < content.length) {
    if (content[i] === "[" && content.slice(i, i + 4) === "[UI:") {
      // Flush preceding plain text
      if (i > textStart) {
        parts.push({ type: "text", content: content.slice(textStart, i) });
      }

      const afterTag = i + 4; // position after "[UI:"

      // Locate the type separator ":"
      const typeEnd = content.indexOf(":", afterTag);
      if (typeEnd === -1) { i++; textStart = i - 1; continue; }

      const uiType   = content.slice(afterTag, typeEnd);
      const jsonStart = typeEnd + 1;

      if (content[jsonStart] !== "{") { i++; textStart = i - 1; continue; }

      // Walk forward counting braces until depth returns to 0
      let depth  = 0;
      let jsonEnd = -1;
      for (let j = jsonStart; j < content.length; j++) {
        if      (content[j] === "{") depth++;
        else if (content[j] === "}") { depth--; if (depth === 0) { jsonEnd = j; break; } }
      }

      // Tag must end with "}]"
      if (jsonEnd === -1 || content[jsonEnd + 1] !== "]") { i++; textStart = i - 1; continue; }

      try {
        const data = JSON.parse(content.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
        parts.push({ type: "ui", uiType, data });
      } catch {
        parts.push({ type: "text", content: content.slice(i, jsonEnd + 2) });
      }

      textStart = jsonEnd + 2;
      i         = textStart;
    } else {
      i++;
    }
  }

  if (textStart < content.length) {
    parts.push({ type: "text", content: content.slice(textStart) });
  }

  return parts;
}

// ─── Renderer ────────────────────────────────────────────────────────────────

const AICardRenderer: React.FC<{ content: string }> = ({ content }) => {
  const parts = parseAIContent(content);

  return (
    <div className="space-y-3">
      {parts.map((part, index) => {
        // ── Plain text / markdown ──────────────────────────────────────────
        if (part.type === "text") {
          return (
            <div key={index} className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {part.content}
              </ReactMarkdown>
            </div>
          );
        }

        // ── UI Blocks ─────────────────────────────────────────────────────
        const { uiType, data } = part;

        switch (uiType) {
          case "PRODUCT_LIST":
          case "RECOMMENDATIONS": {
            const products = (
              (data.products ?? data.items ?? []) as ProductItem[]
            );
            return <ProductListCard key={index} products={products} />;
          }

          case "PRODUCT_DETAIL": {
            const product = data.product as ProductDetailShape;
            return <ProductDetailCard key={index} product={product} />;
          }

          case "CART_SUMMARY":
            return (
              <CartSummaryCard
                key={index}
                total={data.total as number ?? 0}
                count={data.count as number ?? 0}
              />
            );

          case "ADMIN_STATS":
            return (
              <AdminStatsCard
                key={index}
                data={data as unknown as AdminStatsData}
              />
            );

          case "INVENTORY_REPORT":
            return (
              <InventoryReportCard
                key={index}
                data={data as unknown as InventoryData}
              />
            );

          case "ACTION_RESULT":
            return (
              <ActionResultCard
                key={index}
                data={data as unknown as ActionResultData}
              />
            );

          case "NOTIFICATIONS": {
            const list = (
              (data.list ?? data.notifications ?? []) as NotificationItem[]
            );
            return <NotificationListCard key={index} list={list} />;
          }

          default:
            return null;
        }
      })}
    </div>
  );
};

export default AICardRenderer;
