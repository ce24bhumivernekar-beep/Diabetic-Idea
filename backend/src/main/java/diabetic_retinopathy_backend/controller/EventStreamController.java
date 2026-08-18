package diabetic_retinopathy_backend.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import diabetic_retinopathy_backend.service.ScreeningEventService;

/**
 * Live event stream for the dashboards.
 *
 * The browser EventSource API cannot set an Authorization header, so this one
 * endpoint also accepts the JWT as a "token" query parameter -
 * see JwtAuthenticationFilter.
 */
@RestController
@RequestMapping("/api/events")
public class EventStreamController {

    private final ScreeningEventService events;

    public EventStreamController(
            ScreeningEventService events) {

        this.events = events;
    }

    @GetMapping(
            value = "/stream",
            produces = MediaType.TEXT_EVENT_STREAM_VALUE
    )
    public SseEmitter stream(
            @RequestAttribute("userId") String userId,
            @RequestAttribute("userRole") String userRole) {

        return events.subscribe(userId, userRole);
    }
}
