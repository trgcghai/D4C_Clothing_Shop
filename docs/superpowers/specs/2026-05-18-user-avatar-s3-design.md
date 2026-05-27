# User Avatar Upload to AWS S3 — Design Spec

**Date:** 2026-05-18
**Service:** UserService (Spring Boot 3.3.1, Java 21, Maven)
**Status:** Draft

---

## Overview

Add a dedicated endpoint to UserService that accepts a multipart image file upload, stores it in AWS S3 under `users/avatar/`, and updates the user's `avatar` URL in MariaDB. Old S3 objects are cleaned up on re-upload.

The existing `PUT /api/users/me` (JSON body with avatar URL string) remains unchanged.

---

## New Files

| File | Purpose |
|------|---------|
| `Config/S3Config.java` | Spring `@Configuration` bean for `S3Client` |
| `Service/S3Service.java` | Upload/delete logic, S3 URL construction |

## Modified Files

| File | Change |
|------|--------|
| `Controller/UserController.java` | Add `POST /api/users/me/avatar` endpoint |
| `pom.xml` | Add `software.amazon.awssdk:s3` dependency |
| `.env.example` | Add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `S3_BUCKET_NAME` |
| `application.properties` | Wire env vars + multipart config |

---

## API

### `POST /api/users/me/avatar`

- **Auth:** Required (GatewayIdentityFilter reads `X-User-Id` header)
- **Content-Type:** `multipart/form-data`
- **Form field:** `avatar` (required, file)
- **Constraints:**
  - Only `image/*` MIME types
  - Max 5 MB
- **Response 200:** `UserResponse` JSON with updated avatar URL
- **Response 400:** No file, wrong type, or too large
- **Response 401:** Unauthenticated
- **Response 500:** S3 upload failure

### Existing endpoint unchanged

`PUT /api/users/me` continues to accept `UpdateProfileRequest` as JSON. The `avatar` field (`@URL`-validated string) is still settable via this endpoint for external image URLs.

---

## Data Flow

```
Client
  → POST /api/users/me/avatar  [multipart, field "avatar"]
  → GatewayIdentityFilter extracts authenticated user
  → UserController receives MultipartFile
  → S3Service.uploadAvatar(userId, file):
      1. Load User from repository
      2. If user.avatar contains current bucket S3 URL:
           Extract object key → DeleteObjectCommand → S3
      3. Generate key: users/avatar/{userId}-{timestamp}-{sanitizedFilename}
      4. PutObjectCommand(file.buffer, ContentType=file.mimetype) → S3
      5. Construct public URL: https://{bucket}.s3.{region}.amazonaws.com/{key}
      6. Save URL to user.avatar → repository.save(user)
      7. Return URL
  → UserController maps user → UserResponse (200)
```

---

## S3 Key Format

```
users/avatar/{userId}-{timestamp}-{sanitizedFilename}
```

Example: `users/avatar/42-1716028800000-profile-photo.png`

Follows ProductService pattern (`products/{timestamp}-{uuid}-{filename}`) but uses `userId` for deduplication instead of uuid, since avatar is one-per-user.

---

## Old Avatar Cleanup

On new upload: if the existing `user.avatar` URL contains the current `S3_BUCKET_NAME`, extract the object key by splitting on `.amazonaws.com/`, then issue `DeleteObjectCommand`. Errors during deletion are logged but do not block the new upload — same pattern as ProductService.

---

## Configuration (Environment)

Env vars the user will fill in later:

```properties
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=
```

These are wired through `application.properties`:
```properties
aws.access-key-id=${AWS_ACCESS_KEY_ID}
aws.secret-access-key=${AWS_SECRET_ACCESS_KEY}
aws.region=${AWS_REGION:ap-southeast-1}
aws.s3.bucket-name=${S3_BUCKET_NAME}

# Multipart upload limits
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=5MB
```

---

## Dependencies

Add to `pom.xml`:

```xml
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>s3</artifactId>
    <version>2.25.27</version>
</dependency>
```

Using AWS SDK v2 (consistent with the `@aws-sdk/client-s3` v3 pattern in ProductService — Java equivalent of the same generation).

---

## Error Handling

All handled by the existing `GlobalExceptionHandler` pattern:

| Scenario | HTTP | Mechanism |
|----------|------|-----------|
| No file or empty file | 400 | Spring `@RequestParam(required=true)` + manual check |
| Not an image | 400 | Manual MIME type check in controller |
| File > 5 MB | 400 | `spring.servlet.multipart.max-file-size=5MB` in application.properties |
| Unauthenticated | 401 | `SecurityContextHolder` check |
| User not found | 404 | Repository `orElseThrow` |
| S3 upload fails | 500 | Caught in S3Service, re-thrown as RuntimeException → GlobalExceptionHandler |

---

## Testing Considerations

- Unit test `S3Service` with mocked `S3Client`
- Integration test `POST /api/users/me/avatar` with mocked S3Client bean
- Verify old avatar deletion is triggered on re-upload
- Verify non-image files are rejected with 400
- Verify files exceeding 5 MB are rejected with 400
