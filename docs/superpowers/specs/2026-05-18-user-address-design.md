# User Address — Design Spec

**Date:** 2026-05-18
**Feature:** Add shipping address (province, ward, street) to user profile
**Status:** Draft

---

## Overview

Add `street`, `ward`, `province` fields to the `users` table. Add new "Địa chỉ" tab on Profile page with cascading selects (province → ward) from Vietnam Provinces Open API v2, plus street text input.

Only UserService and frontend are affected. No other microservices.

---

## Backend Changes

### User Entity (`domain/entity/User.java`)

Add 3 fields:

```java
private String street;
private String ward;
private String province;
```

### DTOs

Add same 3 fields to:
- `UserResponse.java`
- `UpdateProfileRequest.java` (nullable, no hard validation needed — optional update)
- `JwtResponse.java` (consistency, used at login)

No new controller endpoint. Existing `PUT /api/users/me` handles these fields via `UpdateProfileRequest`.

### DB Migration

Hibernate `ddl-auto=update` handles adding columns automatically.

---

## Frontend Changes

### New Files

`components/profile/AddressForm.tsx`:
- Province `<select>` — populated once from API v2
- Ward `<select>` — populated when province changes
- Street `<input>`
- Save/Cancel buttons
- Uses `useUpdateProfile()` mutation (existing)

`services/provinceApi.ts`:
```ts
export interface Province { name: string; code: number; }
export interface Ward { name: string; code: number; }

export const getProvinces = async (): Promise<Province[]> =>
  axios.get("https://provinces.open-api.vn/api/v2/").then(r => r.data);

export const getWards = async (provinceCode: number): Promise<Ward[]> =>
  axios.get(`https://provinces.open-api.vn/api/v2/p/${provinceCode}?depth=2`)
    .then(r => r.data.wards);
```

`hooks/useAddress.ts`:
- `useProvinces()` — `useQuery` for province list
- `useWards(provinceCode)` — `useQuery` for ward list, enabled when provinceCode is set

### Modified Files

`pages/Profile.tsx`:
- Add tab "Địa chỉ" with `<AddressForm user={user} />`

`services/authApi.ts`:
- `UpdateProfileRequest` type already supports optional fields — no change needed

---

## API Flow

```
GET https://provinces.open-api.vn/api/v2/
  → [{ name, code }, ...]  34 provinces

GET https://provinces.open-api.vn/api/v2/p/{code}?depth=2
  → { wards: [{ name, code }, ...] }

PUT /api/users/me  { street, ward, province }
  → UserResponse with updated fields
```

---

## Tab Layout

```
[Thông tin] [Địa chỉ] [Đổi mật khẩu]
```

Address tab shows:
- Read mode: displays street, ward, province (or "Chưa cập nhật") + Edit button
- Edit mode: province select → ward select → street input + Save/Cancel

---

## Error Handling

| Scenario | UI |
|----------|-----|
| Province API fails | Alert: "Không tải được danh sách tỉnh/thành" |
| Ward API fails | Alert in ward select area |
| Save fails | Alert from useUpdateProfile error |
| Save success | Switch to read mode, success alert |
