package diabetic_retinopathy_backend.config;

import java.util.Arrays;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

/**
 * Global CORS for the React frontend.
 *
 * Registered at the highest precedence so that responses written directly by
 * {@code JwtAuthenticationFilter} (401 / 403) also carry CORS headers.
 * Without this, the browser hides the real error message behind a generic
 * CORS failure.
 */
@Configuration
public class CorsConfig {

    private final List<String> allowedOriginPatterns;

    public CorsConfig(
            @Value("${app.cors.allowed-origin-patterns}") String patterns) {

        this.allowedOriginPatterns = split(patterns);
    }

    private static List<String> split(String value) {

        return Arrays.stream(value.split(","))
                .map(String::trim)
                .filter(entry -> !entry.isEmpty())
                .toList();
    }

    @Bean
    public FilterRegistrationBean<CorsFilter> corsFilterRegistration() {

        CorsConfiguration configuration = new CorsConfiguration();

        // Patterns, so a phone on http://192.168.1.x:5173 is accepted
        // without listing every device address by hand.
        configuration.setAllowedOriginPatterns(allowedOriginPatterns);

        configuration.setAllowedMethods(
                List.of("GET", "POST", "PUT", "DELETE", "OPTIONS")
        );

        configuration.setAllowedHeaders(
                List.of("Authorization", "Content-Type")
        );

        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        FilterRegistrationBean<CorsFilter> registration =
                new FilterRegistrationBean<>(new CorsFilter(source));

        // Must run before the JWT filter (order 1).
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);

        // The SSE stream is a normal GET; it inherits the same rules.

        return registration;
    }
}
