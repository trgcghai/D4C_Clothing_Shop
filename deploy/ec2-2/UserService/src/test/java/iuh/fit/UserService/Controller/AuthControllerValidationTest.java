package iuh.fit.UserService.Controller;

import iuh.fit.UserService.Config.JwtUtils;
import iuh.fit.UserService.Exception.GlobalExceptionHandler;
import iuh.fit.UserService.Repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.boot.test.mock.mockito.MockBean;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandler.class)
class AuthControllerValidationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthenticationManager authenticationManager;

    @MockBean
    private UserRepository userRepository;

    @MockBean
    private PasswordEncoder passwordEncoder;

    @MockBean
    private JwtUtils jwtUtils;

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void signinShouldReturnBadRequestWhenUsernameMissing() throws Exception {
        String payload = """
                {
                  "password": "123456"
                }
                """;

        mockMvc.perform(post("/api/auth/signin")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.username").exists());
    }

    @Test
    void signupShouldReturnBadRequestWhenEmailInvalidAndPasswordTooShort() throws Exception {
        String payload = """
                {
                  "username": "newuser",
                  "email": "invalid-email",
                  "fullName": "New User",
                  "phoneNumber": "0987654321",
                  "password": "123"
                }
                """;

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.email").exists())
                .andExpect(jsonPath("$.errors.password").exists());
    }

    @Test
    void signupShouldReturnBadRequestWhenPhoneContainsLetters() throws Exception {
        String payload = """
                {
                  "username": "newuser",
                  "email": "newuser@example.com",
                  "fullName": "New User",
                  "phoneNumber": "abcxyz",
                  "password": "123456"
                }
                """;

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.phoneNumber").exists());
    }

    @Test
    void signupShouldReturnBadRequestWhenPhoneMixedDigitsAndLetters() throws Exception {
        String payload = """
                {
                  "username": "newuser",
                  "email": "newuser@example.com",
                  "fullName": "New User",
                  "phoneNumber": "12345abc",
                  "password": "123456"
                }
                """;

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Validation failed"))
                .andExpect(jsonPath("$.errors.phoneNumber").exists());
    }

    @Test
    void signupShouldAcceptPhoneWithPlusPrefix() throws Exception {
        when(userRepository.existsByUsername("newuser")).thenReturn(false);
        when(userRepository.existsByEmail("newuser@example.com")).thenReturn(false);
        when(passwordEncoder.encode("123456")).thenReturn("encoded-password");
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        String payload = """
                {
                  "username": "newuser",
                  "email": "newuser@example.com",
                  "fullName": "New User",
                  "phoneNumber": "+84987654321",
                  "password": "123456"
                }
                """;

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully!"));
    }

    @Test
    void signupShouldAcceptPhoneDigitsOnly() throws Exception {
        when(userRepository.existsByUsername("anotheruser")).thenReturn(false);
        when(userRepository.existsByEmail("anotheruser@example.com")).thenReturn(false);
        when(passwordEncoder.encode("123456")).thenReturn("encoded-password");
        when(userRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        String payload = """
                {
                  "username": "anotheruser",
                  "email": "anotheruser@example.com",
                  "fullName": "Another User",
                  "phoneNumber": "0987654321",
                  "password": "123456"
                }
                """;

        mockMvc.perform(post("/api/auth/signup")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("User registered successfully!"));
    }
}
