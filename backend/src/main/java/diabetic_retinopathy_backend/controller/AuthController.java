package diabetic_retinopathy_backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import diabetic_retinopathy_backend.dto.AuthResponse;
import diabetic_retinopathy_backend.exception.ApiException;
import diabetic_retinopathy_backend.model.User;
import diabetic_retinopathy_backend.security.JwtService;
import diabetic_retinopathy_backend.service.AuthService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final JwtService jwtService;

    public AuthController(
            AuthService authService,
            JwtService jwtService) {

        this.authService = authService;
        this.jwtService = jwtService;
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse register(
            @RequestBody User user) {

        User registeredUser =
                authService.registerUser(user);

        return toAuthResponse(registeredUser);
    }

    @PostMapping("/login")
    public AuthResponse login(
            @RequestBody User loginRequest) {

        User user =
                authService.login(
                        loginRequest.getEmail(),
                        loginRequest.getPassword()
                );

        return toAuthResponse(user);
    }

    @GetMapping("/user/{email}")
    public AuthResponse getUserByEmail(
            @PathVariable String email) {

        User user =
                authService.findUserByEmail(email)
                        .orElseThrow(
                                () -> ApiException.notFound(
                                        "User not found."
                                )
                        );

        return toAuthResponse(user);
    }

    private AuthResponse toAuthResponse(User user) {

        String token =
                jwtService.generateToken(
                        user.getId(),
                        user.getEmail(),
                        user.getRole()
                );

        return new AuthResponse(
                user.getId(),
                user.getName(),
                user.getEmail(),
                user.getRole(),
                token
        );
    }
}
