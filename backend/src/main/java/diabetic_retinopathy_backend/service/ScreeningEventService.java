package diabetic_retinopathy_backend.service;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/**
 * Server-sent events, so a screening appears on the doctor dashboard the
 * moment the patient submits it, and the sign-off appears back on the
 * patient's phone without a refresh.
 *
 * Kept deliberately small: one in-memory list of open connections. That is
 * correct for a single instance; behind more than one instance the events
 * would need a shared broker (Redis pub/sub or Mongo change streams).
 */
@Service
public class ScreeningEventService {

    private static final Logger log =
            LoggerFactory.getLogger(ScreeningEventService.class);

    /** Never time the connection out; the client decides when to leave. */
    private static final long NO_TIMEOUT = 0L;

    private record Subscriber(
            String userId,
            String role,
            SseEmitter emitter) {
    }

    private final List<Subscriber> subscribers =
            new CopyOnWriteArrayList<>();

    public SseEmitter subscribe(
            String userId,
            String role) {

        SseEmitter emitter = new SseEmitter(NO_TIMEOUT);

        Subscriber subscriber =
                new Subscriber(userId, role, emitter);

        subscribers.add(subscriber);

        emitter.onCompletion(() -> subscribers.remove(subscriber));
        emitter.onTimeout(() -> subscribers.remove(subscriber));
        emitter.onError(error -> subscribers.remove(subscriber));

        try {

            emitter.send(
                    SseEmitter.event()
                            .name("connected")
                            .data(Map.of(
                                    "role", role,
                                    "subscribers", subscribers.size()
                            ))
            );

        } catch (IOException error) {

            subscribers.remove(subscriber);
        }

        log.info(
                "SSE subscribed: role={} total={}",
                role,
                subscribers.size()
        );

        return emitter;
    }

    /**
     * A patient submitted a new screening - tell every connected doctor.
     */
    public void screeningCreated(
            String screeningId,
            String patientId,
            String patientName,
            String prediction) {

        Map<String, Object> payload = Map.of(
                "screeningId", screeningId,
                "patientId", patientId,
                "patientName", patientName == null ? "" : patientName,
                "prediction", prediction == null ? "" : prediction
        );

        send("DOCTOR", null, "screening-created", payload);
    }

    /**
     * A doctor signed a screening off - tell the patient who owns it.
     */
    public void screeningReviewed(
            String screeningId,
            String patientUserId,
            String decision,
            String reviewedBy) {

        Map<String, Object> payload = Map.of(
                "screeningId", screeningId,
                "decision", decision == null ? "" : decision,
                "reviewedBy", reviewedBy == null ? "" : reviewedBy
        );

        send("PATIENT", patientUserId, "screening-reviewed", payload);

        // Other doctors are looking at the same queue.
        send("DOCTOR", null, "screening-reviewed", payload);
    }

    /**
     * Proxies and mobile networks drop idle connections; a comment every
     * 20 seconds keeps them open.
     */
    @Scheduled(fixedDelay = 20_000)
    public void heartbeat() {

        for (Subscriber subscriber : subscribers) {

            try {

                subscriber.emitter().send(
                        SseEmitter.event().comment("ping")
                );

            } catch (IOException | IllegalStateException error) {

                subscribers.remove(subscriber);
            }
        }
    }

    public int openConnections() {
        return subscribers.size();
    }

    private void send(
            String role,
            String userId,
            String eventName,
            Map<String, Object> payload) {

        for (Subscriber subscriber : subscribers) {

            if (!role.equals(subscriber.role())) {
                continue;
            }

            // A user id narrows the delivery to one account.
            if (userId != null
                    && !userId.equals(subscriber.userId())) {
                continue;
            }

            try {

                subscriber.emitter().send(
                        SseEmitter.event()
                                .name(eventName)
                                .data(payload)
                );

            } catch (IOException | IllegalStateException error) {

                subscribers.remove(subscriber);
            }
        }
    }
}
