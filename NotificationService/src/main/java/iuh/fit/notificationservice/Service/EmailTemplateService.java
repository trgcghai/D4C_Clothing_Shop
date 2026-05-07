package iuh.fit.notificationservice.Service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.HashMap;
import java.util.Map;

@Service
public class EmailTemplateService {

    private final TemplateEngine templateEngine;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public EmailTemplateService(TemplateEngine templateEngine) {
        this.templateEngine = templateEngine;
    }

    @SuppressWarnings("unchecked")
    public String render(String templateName, Map<String, String> variables) {
        Context context = new Context();
        Map<String, Object> merged = new HashMap<>();
        merged.put("frontendUrl", frontendUrl);
        if (variables != null) {
            merged.putAll((Map<String, Object>) (Map<?, ?>) variables);
        }
        context.setVariables(merged);
        return templateEngine.process("email/" + templateName, context);
    }
}
