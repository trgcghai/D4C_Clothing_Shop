package iuh.fit.UserService.Service.impl;

import iuh.fit.UserService.Repository.UserRepository;
import iuh.fit.UserService.Service.S3Service;
import iuh.fit.UserService.Service.UserService;
import iuh.fit.UserService.domain.dto.AddressRequest;
import iuh.fit.UserService.domain.dto.ChangePasswordRequest;
import iuh.fit.UserService.domain.dto.UpdateProfileRequest;
import iuh.fit.UserService.domain.dto.UserResponse;
import iuh.fit.UserService.domain.entity.Address;
import iuh.fit.UserService.domain.entity.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final S3Service s3Service;

    public UserServiceImpl(
            UserRepository userRepository,
            PasswordEncoder encoder,
            S3Service s3Service) {
        this.userRepository = userRepository;
        this.encoder = encoder;
        this.s3Service = s3Service;
    }

    @Override
    public UserResponse getCurrentUser(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));
        return toUserResponse(user);
    }

    @Override
    public UserResponse updateProfile(String username, UpdateProfileRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        user.setFullName(request.getFullName());
        user.setPhoneNumber(request.getPhoneNumber());
        user.setAvatar(request.getAvatar());
        userRepository.save(user);

        return toUserResponse(user);
    }

    @Override
    public String changePassword(String username, ChangePasswordRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        if (!encoder.matches(request.getOldPassword(), user.getPassword())) {
            throw new RuntimeException("Old password is incorrect");
        }

        user.setPassword(encoder.encode(request.getNewPassword()));
        userRepository.save(user);

        return "Password changed successfully";
    }

    @Override
    public UserResponse uploadAvatar(String username, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File is required");
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Only image files are allowed");
        }

        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String avatarUrl = s3Service.uploadAvatar(user.getId(), file);
        user.setAvatar(avatarUrl);
        userRepository.save(user);

        return toUserResponse(user);
    }

    @Override
    public UserResponse updateAddress(String username, AddressRequest request) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new RuntimeException("User not found"));

        Address address = user.getAddress();
        if (address == null) {
            address = new Address();
            address.setUser(user);
        }

        address.setStreet(request.getStreet());
        address.setWard(request.getWard());
        address.setProvince(request.getProvince());

        user.setAddress(address);
        userRepository.save(user);

        return toUserResponse(user);
    }

    private UserResponse toUserResponse(User user) {
        Address address = user.getAddress();
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getFullName(),
                user.getPhoneNumber(),
                user.getAvatar(),
                address != null ? address.getStreet() : null,
                address != null ? address.getWard() : null,
                address != null ? address.getProvince() : null,
                user.getRole());
    }
}
