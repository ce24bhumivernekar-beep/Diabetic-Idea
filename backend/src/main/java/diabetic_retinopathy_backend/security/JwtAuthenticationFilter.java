package diabetic_retinopathy_backend.security;

import java.io.IOException;

import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Reads the Bearer token, exposes userId / userRole as request attributes
 * and enforces coarse role rules per URL prefix.
 *
 * Runs after the CORS filter (see CorsConfig) so the 401 / 403 bodies it
 * writes are readable by the browser.
 */
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

            filterChain.doFilter(request, response);

            return;
        }

        // -----------------------------------------------------
        // Public endpoints
        // -----------------------------------------------------

        if (isPublic(path)) {

            filterChain.doFilter(request, response);

            return;
        }

        // -----------------------------------------------------
        // Get JWT
        // -----------------------------------------------------

        String token = readToken(request);

        if (token == null) {

            sendError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Authentication token required."
            );

            return;
        }

        try {

            Claims claims = jwtService.parse(token);

            String userId = claims.getSubject();
            String role = (String) claims.get("role");

            // -------------------------------------------------
            // Role protection
            // -------------------------------------------------

            if (isPrefix(path, "/api/doctor")
                    && !"DOCTOR".equals(role)) {

                sendError(
                        response,
                        HttpServletResponse.SC_FORBIDDEN,
                        "Doctor access required."
                );

                return;
            }

            if (isPrefix(path, "/api/patients")
                    && !"PATIENT".equals(role)
                    && !"DOCTOR".equals(role)) {

                sendError(
                        response,
                        HttpServletResponse.SC_FORBIDDEN,
                        "Patient or doctor access required."
                );

                return;
            }

            // -------------------------------------------------
            // Store authenticated user information
            // -------------------------------------------------

            request.setAttribute("userId", userId);
            request.setAttribute("userRole", role);
            request.setAttribute(
                    "userEmail",
                    claims.get("email")
            );

            filterChain.doFilter(request, response);

        } catch (JwtException |
                 IllegalArgumentException error) {

            sendError(
                    response,
                    HttpServletResponse.SC_UNAUTHORIZED,
                    "Invalid or expired authentication token."
            );
        }
    }

    /**
     * Normally the Bearer header. The browser EventSource API cannot set
     * headers, so the SSE endpoint may also pass the token as a query
     * parameter - nowhere else, to keep tokens out of access logs.
     */
    private String readToken(HttpServletRequest request) {

        String authHeader =
                request.getHeader("Authorization");

        if (authHeader != null
                && authHeader.startsWith("Bearer ")) {

            return authHeader.substring(7);
        }

        if (isPrefix(request.getRequestURI(), "/api/events")) {

            String queryToken =
                    request.getParameter("token");

            if (queryToken != null && !queryToken.isBlank()) {
                return queryToken;
            }
        }

        return null;
    }

    private boolean isPublic(String path) {

        return isPrefix(path, "/api/auth")
                || path.equals("/api/health");
    }

    /**
     * Matches "/api/doctor" itself as well as everything below it, so a
     * collection endpoint without a trailing slash is not left unguarded.
     */
    private boolean isPrefix(
            String path,
            String prefix) {

        return path.equals(prefix)
                || path.startsWith(prefix + "/");
    }

    private void sendError(
            HttpServletResponse response,
            int status,
            String message)
            throws IOException {

        response.setStatus(status);

        response.setContentType("application/json");

        response.setCharacterEncoding("UTF-8");

        response.getWriter().write(
                "{\"error\":\"" + message + "\",\"status\":" + status + "}"
        );
    }
}
