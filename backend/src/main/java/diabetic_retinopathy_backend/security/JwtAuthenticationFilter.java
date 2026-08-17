package diabetic_retinopathy_backend.security;

import java.io.IOException;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class JwtAuthenticationFilter
        extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthenticationFilter(
            JwtService jwtService) {

        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain)
            throws ServletException, IOException {

        String path = request.getRequestURI();

        // -----------------------------------------------------
        // Allow browser CORS preflight requests
        // -----------------------------------------------------

        if ("OPTIONS".equalsIgnoreCase(
                request.getMethod())) {

            filterChain.doFilter(
                    request,
                    response
            );

            return;
        }

        // -----------------------------------------------------
        // Authentication endpoints are public
        // -----------------------------------------------------

        if (path.startsWith("/api/auth/")) {

            filterChain.doFilter(
                    request,
                    response
            );

            return;
        }

        // -----------------------------------------------------
        // Get JWT
        // -----------------------------------------------------

        String authHeader =
                request.getHeader("Authorization");

        if (authHeader == null ||
                !authHeader.startsWith("Bearer ")) {

            sendUnauthorized(
                    response,
                    "Authentication token required."
            );

            return;
        }

        String token =
                authHeader.substring(7);

        try {

            String userId =
                    jwtService.getUserId(token);

            String role =
                    jwtService.getRole(token);

            // -------------------------------------------------
            // Role protection
            // -------------------------------------------------

            if (path.startsWith("/api/doctor/")
                    && !"DOCTOR".equals(role)) {

                sendForbidden(
                        response,
                        "Doctor access required."
                );

                return;
            }

            if (path.startsWith("/api/patients/")
                    && !"PATIENT".equals(role)
                    && !"DOCTOR".equals(role)) {

                sendForbidden(
                        response,
                        "Patient or doctor access required."
                );

                return;
            }

            // -------------------------------------------------
            // Store authenticated user information
            // -------------------------------------------------

            request.setAttribute(
                    "userId",
                    userId
            );

            request.setAttribute(
                    "userRole",
                    role
            );

            filterChain.doFilter(
                    request,
                    response
            );

        } catch (JwtException |
                 IllegalArgumentException error) {

            sendUnauthorized(
                    response,
                    "Invalid or expired authentication token."
            );
        }
    }

    private void sendUnauthorized(
            HttpServletResponse response,
            String message)
            throws IOException {

        response.setStatus(
                HttpServletResponse.SC_UNAUTHORIZED
        );

        response.setContentType(
                "application/json"
        );

        response.getWriter().write(
                "{\"error\":\"" +
                message +
                "\"}"
        );
    }

    private void sendForbidden(
            HttpServletResponse response,
            String message)
            throws IOException {

        response.setStatus(
                HttpServletResponse.SC_FORBIDDEN
        );

        response.setContentType(
                "application/json"
        );

        response.getWriter().write(
                "{\"error\":\"" +
                message +
                "\"}"
        );
    }
}