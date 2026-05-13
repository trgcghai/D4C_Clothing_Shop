package com.iuh.fit.domain.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditLogResponse {
    private Long id;
    private Long orderId;
    private Long adminUserId;
    private String previousStatus;
    private String newStatus;
    private String note;
    private Instant createdAt;
}
