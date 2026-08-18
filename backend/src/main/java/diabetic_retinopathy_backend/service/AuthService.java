package diabetic_retinopathy_backend.service;

import java.util.Optional;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import diabetic_retinopathy_backend.exception.ApiException;
import diabetic_retinopathy_backend.model.User;
import diabetic_retinopathy_backend.repository.UserRepository;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthService(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {

        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    private static final java.util.Set<String> ROLES =
            java.util.Set.of("PATIENT", "DOCTOR");

    public User registerUser(User user) {

        validate(user);

        Optional<User> existingUser =
                userRepository.findByEmail(user.getEmail());

        if (existingUser.isPresent()) {
            throw ApiException.conflict(
                    "User with this email already exists."
            );
        }

        String hashedPassword =
                passwordEncoder.encode(user.getPassword());

        user.setPassword(hashedPassword);

        return userRepository.save(user);
    }

    private void validate(User user) {

        if (isBlank(user.getEmail())) {
            throw ApiException.badRequest("Email is required.");
        }

        if (isBlank(user.getPassword())
                || user.getPassword().length() < 6) {

            throw ApiException.badRequest(
                    "Password must be at least 6 characters."
            );
        }

        if (isBlank(user.getName())) {
            throw ApiException.badRequest("Name is required.");
        }

        if (user.getRole() == null
                || !ROLES.contains(user.getRole())) {

            throw ApiException.badRequest(
                    "Role must be PATIENT or DOCTOR."
            );
        }

        user.setEmail(user.getEmail().trim().toLowerCase());
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public Optional<User> findUserByEmail(String email) {
        return userRepository.findByEmail(email);
    }

    public boolean checkPassword(
            String rawPassword,
            String hashedPassword) {

        return passwordEncoder.matches(
                rawPassword,
                hashedPassword
        );
    }

    public User login(
            String email,
            String password) {

        User user =
                userRepository.findByEmail(
                                email == null
                                        ? null
                                        : email.trim().toLowerCase())
                        .orElseThrow(
                                () -> ApiException.unauthorized(
                                        "Invalid email or password."
                                )
                        );

        if (!passwordEncoder.matches(
                password,
                user.getPassword())) {

            throw ApiException.unauthorized(
                    "Invalid email or password."
            );
        }

        return user;
    }
}