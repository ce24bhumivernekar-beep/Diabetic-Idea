package diabetic_retinopathy_backend.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import diabetic_retinopathy_backend.dto.AuthResponse;
import diabetic_retinopathy_backend.model.User;
import diabetic_retinopathy_backend.security.JwtService;
import diabetic_retinopathy_backend.service.AuthService;

@CrossOrigin(origins = "http://localhost:5173")
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

        String token =
                jwtService.generateToken(
                        registeredUser.getId(),
                        registeredUser.getEmail(),
                        registeredUser.getRole()
                );

        return new AuthResponse(
                registeredUser.getId(),
                registeredUser.getName(),
                registeredUser.getEmail(),
                registeredUser.getRole(),
                token
        );
    }

    @GetMapping("/user/{email}")
    public AuthResponse getUserByEmail(
            @PathVariable String email) {

        User user =
                authService.findUserByEmail(email)
                        .orElseThrow(
                                () -> new RuntimeException(
                                        "User not found."
                                )
                        );

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

    @PostMapping("/login")
    public AuthResponse login(
            @RequestBody User loginRequest) {

        User user =
                authService.login(
                        loginRequest.getEmail(),
                        loginRequest.getPassword()
                );

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