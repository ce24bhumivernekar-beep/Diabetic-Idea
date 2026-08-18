package diabetic_retinopathy_backend.exception;

/**
 * The Python AI service was unreachable or returned an error.
 */
public class AiServiceException extends RuntimeException {

    public AiServiceException(
            String message,
            Throwable cause) {

        super(message, cause);
    }

    public AiServiceException(String message) {
        super(message);
    }
}
