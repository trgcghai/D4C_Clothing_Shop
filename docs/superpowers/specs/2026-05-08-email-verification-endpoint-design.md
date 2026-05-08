# Email Verification Endpoint Design

**Date:** 2026-05-08
**Status:** Approved

## Overview

Add `POST /api/auth/verify-email` endpoint to UserService that validates a 6-digit code against Redis, and if valid, sets the user's `emailVerification` field to `true`.

## Endpoint

**URL:** `POST /api/auth/verify-email` (no auth required)

**Request body:**
```json
{
  "userId": 123,
  "verificationCode": "456789"
}
```

**Validation:**
- `userId`: required, Long
- `verificationCode`: required, exactly 6 characters

## Logic (AuthService.verifyEmail)

1. Look up Redis key `verification:{userId}`
2. If null → code expired or never existed → throw `RuntimeException("Verification code has expired or is invalid")`
3. If code doesn't match → throw `RuntimeException("Verification code is incorrect")`
4. If match → find user by ID, set `emailVerification = true`, save user, delete Redis key
5. Return success

## Responses

**200 OK:**
```json
{ "message": "Email verified successfully" }
```

**400 Bad Request (expired):**
```json
{ "message": "Verification code has expired or is invalid" }
```

**400 Bad Request (wrong code):**
```json
{ "message": "Verification code is incorrect" }
```

## Files Changed

| File | Change |
|------|--------|
| `Service/AuthService.java` | Add `verifyEmail(Long userId, String code)` method |
| `Service/AuthServiceImpl.java` | Implement `verifyEmail()` with Redis lookup + user update |
| `Controller/AuthController.java` | Add `POST /api/auth/verify-email` endpoint |
| `domain/dto/VerifyEmailRequest.java` | New DTO with userId + verificationCode |

## Security

No authentication required. The `userId` + 6-digit code serves as proof of identity since only the legitimate user has access to their email inbox.
