# Double Opt-In Signup Design

**Date:** 2026-05-29
**Status:** Approved

## Problem

Users can signup with invalid/non-existent emails. The account is created in DB immediately, but the OTP email bounces. The account can never be verified (can't login) and becomes a zombie record. Username squatting is also possible.

## Solution: Double Opt-In (Option A)

Don't create the DB user on signup. Store signup data in Redis with TTL. Only create the DB user after email verification succeeds.

## Architecture

### Redis Key Structure

| Key | Type | TTL | Data |
|-----|------|-----|------|
| `pending_signup:email:{email}` | Hash | 5 min | `{username, email, fullName, phoneNumber, password, role}` |
| `verification:email:{email}` | String | 5 min | OTP code (6 digits) |

### Signup Flow

```
POST /api/auth/signup
  ↓
1. Check DB: username exists? → 400
2. Check DB: email exists? → 400
3. Check Redis: pending_signup:email:{email} exists? → 400
4. Store signup data in Redis hash (TTL 5 min)
5. Generate OTP, store as verification:email:{email} (TTL 5 min)
6. Send verification email via RabbitMQ
7. Return {"message": "Verification email sent. Please check your inbox."}
```

### Verify Flow

```
POST /api/auth/verify-email { email, verificationCode }
  ↓
1. Lookup verification:email:{email} → verify code
2. Lookup pending_signup:email:{email} → get signup data
3. Create User in DB, set emailVerification = true, enabled = true
4. Delete both Redis keys
5. Return {"message": "Email verified successfully. Account created."}
```

### Error Handling

| Scenario | HTTP | Message |
|----------|------|---------|
| Username taken | 400 | "Username is already taken!" |
| Email taken (DB) | 400 | "Email is already taken!" |
| Email pending (Redis) | 400 | "Email already has pending verification. Please check your inbox." |
| OTP expired/invalid | 400 | "Verification code has expired or is invalid" |
| Pending data not found | 400 | "No pending signup found for this email. Please sign up first." |

## Files to Change

### Backend (UserService)

| File | Change |
|------|--------|
| `Config/RateLimitInterceptor.java` | No changes (already rate limits signup by IP) |
| `Controller/AuthController.java` | Update `verifyEmail` to accept email instead of userId |
| `Service/AuthService.java` | Update `verifyEmail(Long, String)` → `verifyEmail(String, String)` |
| `Service/impl/AuthServiceImpl.java` | Rewrite `register()` to use Redis, rewrite `verifyEmail()` to create DB user |
| `domain/dto/VerifyEmailRequest.java` | Replace `userId` field with `email` field |

### Frontend

| File | Change |
|------|--------|
| `src/pages/VerifyEmail.tsx` | Replace userId lookup with email from form state |
| `src/services/authApi.ts` | Update `verifyEmail()` payload from `{userId, code}` to `{email, code}` |

## Rollback

Revert all changed files. The old flow (create DB user first) is restored. No data migration needed — existing unverified DB users can be cleaned up manually.
