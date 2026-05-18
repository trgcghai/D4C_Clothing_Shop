# User Avatar Upload to AWS S3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multipart avatar upload endpoint to UserService, storing images in AWS S3 under `users/avatar/` with old avatar cleanup.

**Architecture:** Spring Boot S3Client bean → S3Service (upload + delete) → UserController endpoint. Follows ProductService S3 patterns. Two new files, five modified files.

**Tech Stack:** Spring Boot 3.3.1, Java 21, AWS SDK v2 (`software.amazon.awssdk:s3`), MockMvc for tests.

---

### Task 1: Add AWS S3 dependency to pom.xml

**Files:**
- Modify: `UserService/pom.xml`

- [ ] **Step 1: Add the dependency**

Insert after the `nimbus-jose-jwt` dependency (line 135):

```xml
        <!-- AWS S3 -->
        <dependency>
            <groupId>software.amazon.awssdk</groupId>
            <artifactId>s3</artifactId>
            <version>2.25.27</version>
        </dependency>
```

- [ ] **Step 2: Verify dependency resolves**

```powershell
cd UserService; ./mvnw dependency:resolve -DincludeArtifactIds=s3 2>&1 | Select-String "BUILD"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```powershell
git add UserService/pom.xml
git commit -m "build: add AWS SDK S3 dependency to UserService"
```

---

### Task 2: Create S3Config.java

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Config/S3Config.java`

- [ ] **Step 1: Write S3Config class**

```java
package iuh.fit.UserService.Config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Configuration
public class S3Config {

    @Value("${aws.access-key-id}")
    private String accessKeyId;

    @Value("${aws.secret-access-key}")
    private String secretAccessKey;

    @Value("${aws.region:ap-southeast-1}")
    private String region;

    @Bean
    public S3Client s3Client() {
        AwsBasicCredentials credentials = AwsBasicCredentials.create(accessKeyId, secretAccessKey);
        return S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(credentials))
                .build();
    }
}
```

- [ ] **Step 2: Compile to verify**

```powershell
cd UserService; ./mvnw compile 2>&1 | Select-String "BUILD"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Commit**

```powershell
git add UserService/src/main/java/iuh/fit/UserService/Config/S3Config.java
git commit -m "feat: add S3Client configuration bean"
```

---

### Task 3: Create S3Service.java

**Files:**
- Create: `UserService/src/main/java/iuh/fit/UserService/Service/S3Service.java`

- [ ] **Step 1: Write S3Service class**

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.domain.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3Service {

    private final S3Client s3Client;
    private final UserRepository userRepository;

    @Value("${aws.s3.bucket-name}")
    private String bucketName;

    @Value("${aws.region:ap-southeast-1}")
    private String region;

    public String uploadAvatar(Long userId, MultipartFile file) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String oldAvatar = user.getAvatar();
        if (oldAvatar != null && oldAvatar.contains(bucketName)) {
            try {
                String oldKey = oldAvatar.split("\\.amazonaws\\.com/")[1];
                if (oldKey != null && !oldKey.isEmpty()) {
                    s3Client.deleteObject(DeleteObjectRequest.builder()
                            .bucket(bucketName)
                            .key(URLDecoder.decode(oldKey, StandardCharsets.UTF_8))
                            .build());
                    log.info("Deleted old avatar from S3: {}", oldKey);
                }
            } catch (Exception e) {
                log.warn("Failed to delete old avatar from S3: {}", e.getMessage());
            }
        }

        String sanitizedFilename = file.getOriginalFilename() != null
                ? file.getOriginalFilename().replaceAll("\\s", "-")
                : "avatar";
        String key = String.format("users/avatar/%d-%d-%s",
                userId, System.currentTimeMillis(), sanitizedFilename);

        try {
            s3Client.putObject(
                    PutObjectRequest.builder()
                            .bucket(bucketName)
                            .key(key)
                            .contentType(file.getContentType())
                            .build(),
                    RequestBody.fromBytes(file.getBytes())
            );
            log.info("Uploaded avatar to S3: {}", key);
        } catch (Exception e) {
            throw new RuntimeException("Failed to upload avatar to S3: " + e.getMessage(), e);
        }

        String avatarUrl = String.format("https://%s.s3.%s.amazonaws.com/%s",
                bucketName, region, key);

        user.setAvatar(avatarUrl);
        userRepository.save(user);

        return avatarUrl;
    }
}
```

- [ ] **Step 2: Compile to verify**

```powershell
cd UserService; ./mvnw compile 2>&1 | Select-String "BUILD"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 3: Write unit tests for S3Service**

Create: `UserService/src/test/java/iuh/fit/UserService/Service/S3ServiceTest.java`

```java
package iuh.fit.UserService.Service;

import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.domain.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class S3ServiceTest {

    @Mock
    private S3Client s3Client;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private S3Service s3Service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(s3Service, "bucketName", "test-bucket");
        ReflectionTestUtils.setField(s3Service, "region", "ap-southeast-1");
    }

    @Test
    void uploadAvatarShouldUploadAndReturnUrlWhenNoOldAvatar() throws Exception {
        User user = new User();
        user.setId(1L);
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "avatar", "photo.png", "image/png", "fake-image-data".getBytes()
        );

        String url = s3Service.uploadAvatar(1L, file);

        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
        assertTrue(url.contains("test-bucket"));
        assertTrue(url.contains("users/avatar/1-"));
    }

    @Test
    void uploadAvatarShouldDeleteOldAvatarWhenSameBucket() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setAvatar("https://test-bucket.s3.ap-southeast-1.amazonaws.com/users/avatar/1-123-old.png");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "avatar", "new.png", "image/png", "data".getBytes()
        );

        s3Service.uploadAvatar(1L, file);

        verify(s3Client).deleteObject(any(DeleteObjectRequest.class));
        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void uploadAvatarShouldNotDeleteWhenExternalUrl() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setAvatar("https://example.com/images/avatar.png");
        when(userRepository.findById(1L)).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        MockMultipartFile file = new MockMultipartFile(
                "avatar", "photo.png", "image/png", "data".getBytes()
        );

        s3Service.uploadAvatar(1L, file);

        verify(s3Client, never()).deleteObject(any(DeleteObjectRequest.class));
        verify(s3Client).putObject(any(PutObjectRequest.class), any(RequestBody.class));
    }

    @Test
    void uploadAvatarShouldThrowWhenUserNotFound() {
        when(userRepository.findById(99L)).thenReturn(Optional.empty());

        MockMultipartFile file = new MockMultipartFile(
                "avatar", "photo.png", "image/png", "data".getBytes()
        );

        assertThrows(RuntimeException.class, () -> s3Service.uploadAvatar(99L, file));
    }
}
```

- [ ] **Step 4: Run S3Service tests**

```powershell
cd UserService; ./mvnw test -Dtest=S3ServiceTest 2>&1 | Select-String "Tests run|BUILD"
```

Expected: `Tests run: 4, Failures: 0, Errors: 0, Skipped: 0` and `BUILD SUCCESS`

- [ ] **Step 5: Commit**

```powershell
git add UserService/src/main/java/iuh/fit/UserService/Service/S3Service.java UserService/src/test/java/iuh/fit/UserService/Service/S3ServiceTest.java
git commit -m "feat: add S3Service for avatar upload with old avatar cleanup"
```

---

### Task 4: Configure application.properties and .env.example

**Files:**
- Modify: `UserService/src/main/resources/application.properties`
- Modify: `UserService/.env.example`

- [ ] **Step 1: Add AWS + multipart config to application.properties**

Append to end of `application.properties`:

```properties
# AWS S3
aws.access-key-id=${AWS_ACCESS_KEY_ID}
aws.secret-access-key=${AWS_SECRET_ACCESS_KEY}
aws.region=${AWS_REGION:ap-southeast-1}
aws.s3.bucket-name=${S3_BUCKET_NAME}

# Multipart upload limits
spring.servlet.multipart.max-file-size=5MB
spring.servlet.multipart.max-request-size=5MB
```

- [ ] **Step 2: Add AWS env vars to .env.example**

Append to end of `.env.example`:

```properties
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-southeast-1
S3_BUCKET_NAME=
```

- [ ] **Step 3: Commit**

```powershell
git add UserService/src/main/resources/application.properties UserService/.env.example
git commit -m "config: add AWS S3 and multipart settings to UserService"
```

---

### Task 5: Add avatar upload endpoint to UserController

**Files:**
- Modify: `UserService/src/main/java/iuh/fit/UserService/Controller/UserController.java`

- [ ] **Step 1: Add import and field injection for S3Service**

Add import after existing imports:

```java
import iuh.fit.UserService.Service.S3Service;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
```

Add S3Service field injection after PasswordEncoder:

```java
    @Autowired
    private S3Service s3Service;
```

- [ ] **Step 2: Add uploadAvatar method**

Add after the `changePassword` method (before `getCurrentUsername`):

```java
    @PostMapping("/me/avatar")
    @Operation(summary = "Upload user avatar to S3")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Avatar uploaded successfully"),
            @ApiResponse(responseCode = "400", description = "Invalid file"),
            @ApiResponse(responseCode = "401", description = "Unauthorized")
    })
    public ResponseEntity<?> uploadAvatar(@RequestParam("avatar") MultipartFile file) {
        String username = getCurrentUsername();
        if (username == null) {
            return ResponseEntity.status(401).body(Map.of("message", "Unauthorized"));
        }

        if (file == null || file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("message", "File is required"));
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            return ResponseEntity.badRequest().body(Map.of("message", "Only image files are allowed"));
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String avatarUrl = s3Service.uploadAvatar(user.getId(), file);

        return ResponseEntity.ok(toUserResponse(user));
    }
```

- [ ] **Step 3: Compile to verify**

```powershell
cd UserService; ./mvnw compile 2>&1 | Select-String "BUILD"
```

Expected: `BUILD SUCCESS`

- [ ] **Step 4: Commit**

```powershell
git add UserService/src/main/java/iuh/fit/UserService/Controller/UserController.java
git commit -m "feat: add POST /api/users/me/avatar endpoint for S3 avatar upload"
```

---

### Task 6: Add avatar upload tests to UserControllerValidationTest

**Files:**
- Modify: `UserService/src/test/java/iuh/fit/UserService/Controller/UserControllerValidationTest.java`

- [ ] **Step 1: Add imports and mock bean**

Add after existing imports:

```java
import iuh.fit.UserService.Service.S3Service;
import org.springframework.mock.web.MockMultipartFile;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
```

Add mock bean after `PasswordEncoder` mock:

```java
    @MockBean
    private S3Service s3Service;
```

- [ ] **Step 2: Add test methods**

Add before the closing `}` of the class:

```java
    @Test
    @WithMockUser(username = "john")
    void uploadAvatarShouldReturn200WhenValidImage() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setUsername("john");
        user.setEmail("john@example.com");
        user.setRole(Role.USER);

        when(userRepository.findByUsername("john")).thenReturn(Optional.of(user));
        when(s3Service.uploadAvatar(eq(1L), any(MultipartFile.class)))
                .thenReturn("https://test-bucket.s3.ap-southeast-1.amazonaws.com/users/avatar/1-123-photo.png");

        MockMultipartFile file = new MockMultipartFile(
                "avatar", "photo.png", "image/png", "fake-image".getBytes()
        );

        mockMvc.perform(multipart("/api/users/me/avatar").file(file))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("john"));
    }

    @Test
    @WithMockUser(username = "john")
    void uploadAvatarShouldReturn400WhenNoFile() throws Exception {
        mockMvc.perform(multipart("/api/users/me/avatar"))
                .andExpect(status().isBadRequest());
    }

    @Test
    @WithMockUser(username = "john")
    void uploadAvatarShouldReturn400WhenEmptyFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "avatar", "photo.png", "image/png", new byte[0]
        );

        mockMvc.perform(multipart("/api/users/me/avatar").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("File is required"));
    }

    @Test
    @WithMockUser(username = "john")
    void uploadAvatarShouldReturn400WhenNonImage() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "avatar", "doc.pdf", "application/pdf", "fake-pdf".getBytes()
        );

        mockMvc.perform(multipart("/api/users/me/avatar").file(file))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only image files are allowed"));
    }

    @Test
    void uploadAvatarShouldReturn401WhenUnauthenticated() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "avatar", "photo.png", "image/png", "data".getBytes()
        );

        mockMvc.perform(multipart("/api/users/me/avatar").file(file))
                .andExpect(status().isUnauthorized());
    }
```

- [ ] **Step 3: Run all tests**

```powershell
cd UserService; ./mvnw test 2>&1 | Select-String "Tests run|BUILD"
```

Expected: all tests pass, BUILD SUCCESS

- [ ] **Step 4: Commit**

```powershell
git add UserService/src/test/java/iuh/fit/UserService/Controller/UserControllerValidationTest.java
git commit -m "test: add avatar upload endpoint tests"
```

---

### Task 7: Full build verification

- [ ] **Step 1: Run full Maven build**

```powershell
cd UserService; ./mvnw clean package 2>&1 | Select-String "Tests run|BUILD"
```

Expected: all tests pass, BUILD SUCCESS

- [ ] **Step 2: Verify no compilation warnings**

```powershell
cd UserService; ./mvnw compile 2>&1 | Select-String "warning|error"
```

Expected: no output (no warnings or errors)
