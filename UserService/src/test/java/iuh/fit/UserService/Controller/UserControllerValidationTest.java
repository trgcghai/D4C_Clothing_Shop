package iuh.fit.UserService.Controller;

import iuh.fit.UserService.Exception.GlobalExceptionHandler;
import iuh.fit.UserService.Repository.UserRepository;
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
}
