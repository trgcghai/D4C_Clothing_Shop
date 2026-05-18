# User Address — Design Spec

**Date:** 2026-05-18
**Feature:** Add shipping address (province, ward, street) to user profile
**Status:** Final

---

## Overview

Create `addresses` table with `street`, `ward`, `province` fields, linked 1-1 to `users`. Add new "Địa chỉ" tab on Profile page with cascading selects (province → ward) from Vietnam Provinces Open API v2.

Only UserService and frontend are affected.

---

## Backend Changes

### New Files

| File | Purpose |
|------|---------|
| `domain/entity/Address.java` | JPA entity: id, userId, street, ward, province |
| `domain/dto/AddressRequest.java` | DTO: street, ward, province (for PUT body) |
| `repository/AddressRepository.java` | JPA repository |

### Modified Files

| File | Change |
|------|--------|
| `domain/entity/User.java` | + `@OneToOne Address address` relation |
| `domain/dto/UserResponse.java` | +street, +ward, +province (flat, từ address) |
| `domain/dto/JwtResponse.java` | +street, +ward, +province (flat) |
| `controller/UserController.java` | + `PUT /api/users/me/address` |

### Address Entity

```java
@Entity
@Table(name = "addresses")
@Data
@NoArgsConstructor
public class Address {
    @Id @GeneratedValue(strategy = IDENTITY)
    private Long id;

    @OneToOne
    @JoinColumn(name = "user_id", unique = true)
    private User user;

    private String street;
    private String ward;
    private String province;
}
```

### User Entity

```java
@OneToOne(mappedBy = "user", cascade = CascadeType.ALL, orphanRemoval = true)
private Address address;
```

### New Endpoint

`PUT /api/users/me/address` — body: `{ street?, ward?, province? }` — returns `UserResponse`

---

## Frontend Changes

### New Files

`services/provinceApi.ts`, `hooks/useAddress.ts` — province/ward API + hooks

`services/authApi.ts` — + `updateAddress()` function

`hooks/useAuth.ts` — + `useUpdateAddress()` mutation

`components/profile/AddressForm.tsx` — form with cascading selects

### Modified Files

`pages/Profile.tsx` — + tab "Địa chỉ"

---

## API Flow

```
PUT /api/users/me/address  { street, ward, province }
  → upsert address → return UserResponse
```

```
GET https://provinces.open-api.vn/api/v2/  →  34 provinces
GET https://provinces.open-api.vn/api/v2/p/{code}?depth=2  →  wards
```
