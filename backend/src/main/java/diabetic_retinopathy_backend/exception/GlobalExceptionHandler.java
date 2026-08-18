package diabetic_retinopathy_backend.exception;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

/**
 * Turns every failure into a small JSON body: {"error": "...", "status": 404}.
 * The React pages read the "error" field, so the user sees the real reason
 * instead of a Spring whitelabel HTML page.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log =
            LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(
            ApiException error) {

        return build(error.getStatus(), error.getMessage());
    }

    @ExceptionHandler(AiServiceException.class)
    public ResponseEntity<Map<String, Object>> handleAiServiceException(
            AiServiceException error) {

        log.error("AI service call failed: {}", error.getMessage());

        return build(HttpStatus.BAD_GATEWAY, error.getMessage());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleTooLarge(
            MaxUploadSizeExceededException error) {

        return build(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "Image is too large. Maximum upload size is 20MB."
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUnexpected(
            Exception error) {

        log.error("Unexpected server error", error);

        return build(
                HttpStatus.INTERNAL_SERVER_ERROR,
                error.getMessage() == null
                        ? "Unexpected server error."
                        : error.getMessage()
        );
    }

    private ResponseEntity<Map<String, Object>> build(
            HttpStatus status,
            String message) {

        Map<String, Object> body = new LinkedHashMap<>();

        body.put("error", message);
        body.put("status", status.value());
        body.put("timestamp", LocalDateTime.now().toString());

        return ResponseEntity.status(status).body(body);
    }
}
