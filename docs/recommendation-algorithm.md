# Recommendation Algorithm – Mô tả thuật toán đề xuất

Tài liệu mô tả chi tiết thuật toán đề xuất sản phẩm dựa trên hành vi người dùng của D4C Clothing Shop.

---

## Tổng quan thuật toán

Hệ thống sử dụng phương pháp **Content-Based Filtering kết hợp User Behavior Scoring**:

- **Behavior Scoring**: Mỗi hành vi của user được gán trọng số → tích lũy điểm theo cặp `(user, product)`.
- **Content-Based Filtering**: Từ các sản phẩm được điểm cao, hệ thống suy ra sở thích người dùng (danh mục, thương hiệu, giới tính) → tìm sản phẩm tương tự chưa được tương tác.

> Không dùng Collaborative Filtering (so sánh với user khác) vì data user còn ít và tránh cold-start theo user.

---

## Bảng trọng số hành vi

| Hành vi (`eventType`) | Trọng số | Lý do |
|---|---|---|
| `view` – Xem chi tiết sản phẩm | **+1** | Thể hiện sự quan tâm sơ bộ, dễ xảy ra |
| `add_to_cart` – Thêm vào giỏ hàng | **+3** | Quan tâm cao hơn, có ý định mua |
| `buy_now` – Mua ngay | **+5** | Hành động quyết đoán, quan tâm rất cao |
| `purchased` – Đã mua thành công | **+10** | Thể hiện sở thích rõ nhất, xác nhận giao dịch |

### Ví dụ tích điểm

```
User A với sản phẩm "Áo Nike Dri-FIT":
  - Xem 3 lần:         3 × 1 = 3
  - Thêm giỏ hàng 1 lần: 1 × 3 = 3
  - Mua 1 lần:         1 × 10 = 10
  → Tổng score = 16
```

---

## Pipeline xử lý

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BEHAVIOR EVENT                       │
│         (view / add_to_cart / buy_now / purchased)          │
└────────────────────────┬────────────────────────────────────┘
                         │ POST /api/behaviors
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 1: Record Event                            │
│   Ghi vào d4c_user_behaviors (append-only log)              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 2: Score Accumulation                      │
│   Atomic increment trong d4c_user_scores:                    │
│   score(userId, productId) += weight[eventType]              │
└─────────────────────────────────────────────────────────────┘


                    GET /api/recommendations
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 3: Fetch Top Scores                        │
│   Query d4c_user_scores theo userId, lấy top-10 productId   │
│   có score cao nhất                                          │
│                                                              │
│   ┌── Cold Start Check ─────────────────────────────────┐   │
│   │ Nếu số lượng scored products < 3                    │   │
│   │ → Trả về Featured Products (fallback)               │   │
│   └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 4: Extract Preference Signals              │
│   Với mỗi top product, thu thập:                             │
│     - preferredCategories = Set of categoryId               │
│     - preferredBrands     = Set of brand (lowercase)         │
│     - preferredGenders    = Set of gender (lowercase)        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 5: Score Candidates                        │
│   Với mỗi sản phẩm CHƯA tương tác:                          │
│     candidateScore = 0                                       │
│     + 3 nếu categoryId ∈ preferredCategories                 │
│     + 2 nếu brand ∈ preferredBrands                          │
│     + 1 nếu gender ∈ preferredGenders                        │
│   → Loại bỏ sản phẩm có candidateScore = 0                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              STEP 6: Sort & Slice                            │
│   Sắp xếp candidates theo candidateScore DESC               │
│   → Lấy top-N (N = limit từ request)                        │
│                                                              │
│   ┌── Supplement Check ─────────────────────────────────┐   │
│   │ Nếu kết quả < limit                                 │   │
│   │ → Bổ sung Featured Products (chưa tương tác)        │   │
│   └─────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
                   Response: Product[]
```

---

## Preference Scoring – Trọng số tín hiệu

Khi đánh giá một sản phẩm ứng viên (candidate), hệ thống tính điểm dựa trên mức độ phù hợp với sở thích đã học được:

| Tín hiệu | Điểm candidate |
|---|---|
| Cùng **danh mục** với sản phẩm được yêu thích | **+3** |
| Cùng **thương hiệu** | **+2** |
| Cùng **giới tính mục tiêu** | **+1** |

> Danh mục được coi là tín hiệu mạnh nhất vì phản ánh nhu cầu cụ thể (áo, quần, phụ kiện...). Thương hiệu thể hiện loyalty. Giới tính là lọc cơ bản.

---

## Cold Start Strategy

Khi người dùng chưa có đủ lịch sử hành vi (< 3 sản phẩm được điểm):

```
isNewUser(userId) → True
      │
      ▼
Fallback: getFeaturedProducts()
  → Trả về danh sách sản phẩm nổi bật (isFeatured=true)
  → Vẫn cá nhân hoá được một phần khi user có thêm data
```

**Ngưỡng cold start**: `COLD_START_THRESHOLD = 3` sản phẩm.

---

## Deduplication & Exclusion

Hệ thống **không bao giờ đề xuất lại** sản phẩm mà user đã tương tác:

```javascript
interactedIds = Set(topScores.map(s => s.productId))
candidates = allProducts.filter(p => !interactedIds.has(p.id))
```

Điều này đảm bảo đề xuất luôn là **sản phẩm mới**, không gây nhàm chán.

---

## Ví dụ end-to-end

### Tình huống

User A có lịch sử:
- Xem "Áo Nike Dri-FIT Nam" × 5 → score = 5
- Mua "Quần Adidas Track Pants Nam" × 1 → score = 10
- Thêm giỏ "Giày Nike Air Max" × 2 → score = 6

### Preference signals học được

```
preferredCategories: { "cat-ao", "cat-quan", "cat-giay" }
preferredBrands:     { "nike", "adidas" }
preferredGenders:    { "nam" }
```

### Candidate scoring (ví dụ)

| Sản phẩm ứng viên | Category match | Brand match | Gender match | candidateScore |
|---|---|---|---|---|
| Áo Nike SB Nam | ✅ (+3) | ✅ (+2) | ✅ (+1) | **6** |
| Quần Adidas Nam | ✅ (+3) | ✅ (+2) | ✅ (+1) | **6** |
| Áo Zara Nam | ✅ (+3) | ❌ | ✅ (+1) | **4** |
| Váy H&M Nữ | ❌ | ❌ | ❌ | **0** → loại |

→ Đề xuất: [Áo Nike SB Nam, Quần Adidas Nam, Áo Zara Nam, ...]

---

## Giới hạn & Hướng mở rộng

| Hạn chế hiện tại | Hướng cải thiện |
|---|---|
| Scan toàn bộ sản phẩm mỗi request | Thêm caching Redis cho recommendation results |
| Không có decay factor theo thời gian | Thêm `createdAt` vào score formula: `weight × decay(time)` |
| Preference chỉ dựa trên top-10 scored | Mở rộng sang Collaborative Filtering khi có đủ data |
| Không phân biệt context (buổi sáng/tối, thiết bị) | Thêm session-based context signals |
