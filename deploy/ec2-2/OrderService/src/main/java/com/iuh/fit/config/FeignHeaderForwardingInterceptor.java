package com.iuh.fit.config;

import feign.RequestInterceptor;
import feign.RequestTemplate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;

@Component
public class FeignHeaderForwardingInterceptor implements RequestInterceptor {

    private static final List<String> GATEWAY_HEADERS = List.of(
            "X-User-Id",
            "X-User-Username",
            "X-User-Email",
            "X-User-Roles"
    );

    @Override
    public void apply(RequestTemplate template) {
        ServletRequestAttributes attrs =
                (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
        if (attrs == null) return;

        HttpServletRequest request = attrs.getRequest();
        for (String header : GATEWAY_HEADERS) {
            String value = request.getHeader(header);
            if (value != null && !value.isBlank()) {
                template.header(header, value);
            }
        }
    }
}
