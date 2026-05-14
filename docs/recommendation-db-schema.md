# Recommendation Database Schema

Tài liệu mô tả thiết kế cơ sở dữ liệu cho hệ thống đề xuất sản phẩm của D4C Clothing Shop.

## Tổng quan

Hệ thống đề xuất sử dụng **2 bảng DynamoDB mới** thêm vào bên cạnh bảng sản phẩm hiện có:

| Bảng | Mục đích |
|---|---|
| `d4c_user_behaviors` | Ghi lại từng sự kiện hành vi của người dùng |
| `d4c_user_scores` | Lưu điểm tích lũy tổng hợp theo cặp (user, product) |

> **Lý do chọn DynamoDB**: Toàn bộ ProductService đã dùng DynamoDB (AWS) để lưu sản phẩm, variants. Thêm 2 bảng mới vào cùng cluster đảm bảo tính nhất quán về infrastructure và tận dụng AWS SDK đã có sẵn.

---

## Bảng 1: `d4c_user_behaviors`

Ghi lại **từng sự kiện** hành vi người dùng theo thời gian thực.

### Schema

| Thuộc tính | Kiểu | Vai trò | Mô tả |
|---|---|---|---|
| `id` | String | **PK (Partition Key)** | UUID tự sinh, định danh duy nhất cho mỗi event |
| `userId` | String | GSI Partition Key | ID của người dùng (lấy từ UserService) |
| `productId` | String | Attribute | ID sản phẩm liên quan |
| `eventType` | String | Attribute | Loại hành vi: `view`, `add_to_cart`, `buy_now`, `purchased` |
| `createdAt` | String (ISO 8601) | GSI Sort Key | Thời điểm xảy ra sự kiện |

### Global Secondary Index (GSI)

```
Index name: userId-createdAt-index
  Partition Key: userId
  Sort Key:      createdAt  (DESC → lấy sự kiện mới nhất trước)
```

### Ví dụ Item

```json
{
  "id":        "a1b2c3d4-...",
  "userId":    "user-789",
  "productId": "prod-456",
  "eventType": "add_to_cart",
  "createdAt": "2026-05-13T05:30:00.000Z"
}
```

### Cách dùng

- Mỗi khi user tương tác với sản phẩm, `POST /api/behaviors` ghi một item mới vào bảng này.
- Không cập nhật item cũ (append-only) → tránh write conflict, dễ audit.
- Query theo `userId-createdAt-index` để lấy lịch sử hành vi theo thứ tự thời gian.

---

## Bảng 2: `d4c_user_scores`

Lưu **điểm tích lũy** tổng hợp của mỗi cặp `(userId, productId)`.

### Schema

| Thuộc tính | Kiểu | Vai trò | Mô tả |
|---|---|---|---|
| `userId` | String | **PK (Partition Key)** | ID người dùng |
| `productId` | String | **SK (Sort Key)** | ID sản phẩm |
| `score` | Number | Attribute | Điểm tích lũy (cộng dồn theo trọng số event) |
| `updatedAt` | String (ISO 8601) | Attribute | Lần cập nhật cuối cùng |

### Global Secondary Index (GSI)

```
Index name: userId-score-index
  Partition Key: userId
  Sort Key:      score  (DESC → sản phẩm có điểm cao nhất trước)
```

### Ví dụ Item

```json
{
  "userId":    "user-789",
  "productId": "prod-456",
  "score":     14,
  "updatedAt": "2026-05-13T05:35:00.000Z"
}
```

> `score = 14` tương đương: xem 1 lần (+1) + thêm giỏ hàng 1 lần (+3) + mua 1 lần (+10).

### Cách dùng

- Mỗi khi ghi behavior event, `UpdateItem` với `ADD score :delta` để tăng điểm nguyên tử (atomic increment).
- Nếu item chưa tồn tại, DynamoDB tạo mới với `score = delta` (upsert).
- Query theo `userId-score-index` để lấy top-N sản phẩm có điểm cao nhất cho một user.

---

## Bảng hiện có (tham chiếu): `d4c_products`

Bảng sản phẩm hiện có, được dùng để populate thông tin đầy đủ khi trả về đề xuất.

| Thuộc tính | Kiểu | Mô tả |
|---|---|---|
| `id` | String (PK) | ID sản phẩm |
| `categoryId` | String | ID danh mục → dùng để tính preference |
| `brand` | String | Thương hiệu → dùng để tính preference |
| `gender` | String | Giới tính mục tiêu → dùng để tính preference |
| `name`, `price`, `imageUrl`, ... | mixed | Thông tin hiển thị |

---

## Luồng ghi dữ liệu

```
User tương tác
      │
      ▼
POST /api/behaviors
  { userId, productId, eventType }
      │
      ├──► PutItem → d4c_user_behaviors   (append event log)
      │
      └──► UpdateItem → d4c_user_scores   (atomic score += weight)
```

## Luồng đọc đề xuất

```
GET /api/recommendations?userId=xxx
      │
      ▼
Query d4c_user_scores (userId-score-index)
  → Top 10 (productId, score) có điểm cao nhất
      │
      ▼
GetItem × N → d4c_products
  → Lấy categoryId, brand, gender của top products
      │
      ▼
Scan d4c_products → lọc & xếp hạng candidates
  → Trả về top-limit sản phẩm chưa tương tác
```

---

## Lưu ý triển khai

> [!IMPORTANT]
> Hai bảng DynamoDB cần được **tạo thủ công trên AWS Console** (hoặc qua Terraform/CDK) trước khi deploy:
>
> **`d4c_user_behaviors`**
> - Partition Key: `id` (String)
> - GSI: `userId-createdAt-index` → PK: `userId`, SK: `createdAt`
> - Billing: On-demand (PAY_PER_REQUEST)
>
> **`d4c_user_scores`**
> - Partition Key: `userId` (String), Sort Key: `productId` (String)
> - GSI: `userId-score-index` → PK: `userId`, SK: `score` (Number)
> - Billing: On-demand (PAY_PER_REQUEST)

> [!NOTE]
> Code trong `behavior.model.js` và `recommendation.model.js` đã có **fallback Scan** nếu GSI chưa được tạo, đảm bảo service không crash trong môi trường dev/test.

> [!TIP]
> Để tiết kiệm chi phí DynamoDB, có thể thêm **TTL** (Time To Live) cho bảng `d4c_user_behaviors`:
> - Thêm thuộc tính `ttl` (Number, Unix timestamp) = `createdAt + 90 ngày`
> - Bật DynamoDB TTL trên thuộc tính `ttl`
> - Behavior cũ tự động bị xóa, điểm tổng hợp trong `d4c_user_scores` vẫn được giữ nguyên.
