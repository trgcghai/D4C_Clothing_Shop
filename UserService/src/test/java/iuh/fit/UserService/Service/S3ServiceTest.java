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
