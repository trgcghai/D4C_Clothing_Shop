package iuh.fit.UserService.Controller;

import iuh.fit.UserService.Exception.GlobalExceptionHandler;
import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.Repository.AddressRepository;
import iuh.fit.UserService.domain.common.Role;
import iuh.fit.UserService.domain.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import iuh.fit.UserService.Service.S3Service;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class UserControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private PasswordEncoder passwordEncoder;

    @MockBean
    private S3Service s3Service;

    @MockBean
    private AddressRepository addressRepository;

    @Test
    void updateProfileShouldReturnBadRequestWhenFullNameBlank() throws Exception {
        String payload = """
                {
                  "fullName": "   "
                }
                """;

        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.fullName").exists());
    }

    @Test
    void updateProfileShouldReturnBadRequestWhenPhoneInvalid() throws Exception {
        String payload = """
                {
                  "phoneNumber": "abc123"
                }
                """;

        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.phoneNumber").exists());
    }

    @Test
    @WithMockUser(username = "john")
    void updateProfileShouldAllowPartialUpdateWhenValid() throws Exception {
        User user = new User();
        user.setId(1L);
        user.setUsername("john");
        user.setEmail("john@example.com");
        user.setRole(Role.USER);

        when(userRepository.findByUsername("john")).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        String payload = """
                {
                  "phoneNumber": "+84987654321"
                }
                """;

        mockMvc.perform(put("/api/users/me")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phoneNumber").value("+84987654321"));
    }

    @Test
    void changePasswordShouldReturnBadRequestWhenMissingFields() throws Exception {
        String payload = """
                {
                  "newPassword": ""
                }
                """;

        mockMvc.perform(put("/api/users/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.oldPassword").exists())
                .andExpect(jsonPath("$.errors.newPassword").exists());
    }

    @Test
    @WithMockUser(username = "john")
    void changePasswordShouldKeepBusinessErrorWhenOldPasswordIncorrect() throws Exception {
        User user = new User();
        user.setUsername("john");
        user.setPassword("$2a$10$dummy");

        when(userRepository.findByUsername("john")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "$2a$10$dummy")).thenReturn(false);

        String payload = """
                {
                  "oldPassword": "wrong-password",
                  "newPassword": "123456"
                }
                """;

        mockMvc.perform(put("/api/users/me/password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Old password is incorrect"));
    }

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
}
