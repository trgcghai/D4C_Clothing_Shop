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
