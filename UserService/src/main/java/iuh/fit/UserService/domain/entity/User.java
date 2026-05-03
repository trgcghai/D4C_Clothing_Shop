package iuh.fit.UserService.domain.entity;

import iuh.fit.UserService.domain.common.Role;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "users")
@Data // Lombok annotation tự động tạo Getter/Setter/ToString
@NoArgsConstructor
@AllArgsConstructor
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String username;

    @Column(unique = true, nullable = false)
    private String email;

    private String fullName;

    private String phoneNumber;

    private String avatar;

    @Column(nullable = false)
    private String password;

    @Enumerated(EnumType.STRING)
    private Role role; // Ví dụ: ROLE_USER, ROLE_ADMIN

    @Column(length = 1000)
    private String refreshToken;

    private Instant refreshTokenExpiryDate;
}
