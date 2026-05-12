package com.iuh.fit.service;

import com.iuh.fit.domain.entity.AuditLog;
import com.iuh.fit.repository.AuditLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public AuditLog record(Long orderId, Long adminUserId, String previousStatus, String newStatus, String note) {
        AuditLog a = new AuditLog();
        a.setOrderId(orderId);
        a.setAdminUserId(adminUserId);
        a.setPreviousStatus(previousStatus);
        a.setNewStatus(newStatus);
        a.setNote(note);
        a.setCreatedAt(Instant.now());
        return auditLogRepository.save(a);
    }

    @Transactional(readOnly = true)
    public List<AuditLog> findForOrder(Long orderId) {
        return auditLogRepository.findByOrderIdOrderByCreatedAtDesc(orderId);
    }
}
