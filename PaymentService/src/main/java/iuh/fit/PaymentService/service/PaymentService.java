package iuh.fit.PaymentService.service;

import iuh.fit.PaymentService.client.OrderClient;
import iuh.fit.PaymentService.config.SePayConfig;
import iuh.fit.PaymentService.domain.dto.CreatePaymentRequest;
import iuh.fit.PaymentService.domain.dto.PaymentResponse;
import iuh.fit.PaymentService.domain.dto.PaymentStatusResponse;
import iuh.fit.PaymentService.domain.entity.Payment;
import iuh.fit.PaymentService.domain.enums.PaymentMethod;
import iuh.fit.PaymentService.domain.enums.PaymentStatus;
import iuh.fit.PaymentService.exception.PaymentException;
import iuh.fit.PaymentService.repository.PaymentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;

@Service
public class PaymentService {

    @Autowired
    private PaymentRepository paymentRepository;

    @Autowired
    private SePayConfig sePayConfig;

    @Autowired
    private OrderClient orderClient;

    @Transactional
    public PaymentResponse createPayment(CreatePaymentRequest request) {
        Payment existing = paymentRepository.findByCheckoutOrderId(request.getCheckoutOrderId())
                .orElse(null);
        if (existing != null) {
            return toResponse(existing);
        }

        Payment payment = new Payment();
        payment.setOrderId(request.getOrderId());
        payment.setCheckoutOrderId(request.getCheckoutOrderId());
        payment.setAmount(request.getAmount());
        payment.setMethod(request.getMethod());
        payment.setStatus(PaymentStatus.PENDING);
        payment.setPaymentCode(sePayConfig.generatePaymentCode());
        payment.setExpiresAt(Instant.now().plusSeconds(5 * 60));

        payment = paymentRepository.save(payment);
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentById(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentException("Payment not found with id: " + paymentId));
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentStatusResponse getPaymentStatus(Long paymentId) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new PaymentException("Payment not found with id: " + paymentId));
        return new PaymentStatusResponse(payment.getId(), payment.getStatus(), payment.getPaidAt());
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByCheckoutOrderId(String checkoutOrderId) {
        Payment payment = paymentRepository.findByCheckoutOrderId(checkoutOrderId)
                .orElseThrow(() -> new PaymentException("Payment not found for order: " + checkoutOrderId));
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByPaymentCode(String paymentCode) {
        Payment payment = paymentRepository.findByPaymentCode(paymentCode)
                .orElseThrow(() -> new PaymentException("Payment not found for code: " + paymentCode));
        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public PaymentResponse getPaymentByOrderId(Long orderId, Long requestingUserId) {
        Payment payment = paymentRepository.findByOrderId(orderId)
                .orElseThrow(() -> new PaymentException("Payment not found for orderId: " + orderId));

        Long orderUserId = orderClient.getOrderUserId(orderId);
        if (!orderUserId.equals(requestingUserId)) {
            throw new PaymentException("Access denied: you do not own this order");
        }

        return toResponse(payment);
    }

    @Transactional(readOnly = true)
    public Payment findPaymentByPaymentCodeOrNull(String paymentCode) {
        return paymentRepository.findByPaymentCode(paymentCode).orElse(null);
    }

    @Transactional
    public PaymentStatusResponse cancelPayment(Long paymentId) {
        int updated = paymentRepository.cancelPayment(paymentId);
        if (updated == 0) {
            Payment payment = paymentRepository.findById(paymentId)
                    .orElseThrow(() -> new PaymentException("Payment not found"));
            throw new PaymentException("Cannot cancel payment with status: " + payment.getStatus());
        }
        return new PaymentStatusResponse(paymentId, PaymentStatus.CANCELLED, null);
    }

    @Transactional
    public PaymentStatusResponse markAsPaid(String paymentCode, Long sepayTxId, String gateway) {
        Instant now = Instant.now();
        int updated = paymentRepository.markAsPaid(paymentCode, sepayTxId, gateway, now);
        if (updated == 0) {
            Payment payment = paymentRepository.findByPaymentCode(paymentCode)
                    .orElseThrow(() -> new PaymentException("Payment not found: " + paymentCode));
            if (payment.getStatus() == PaymentStatus.PAID) {
                return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, payment.getPaidAt());
            }
            throw new PaymentException("Payment already " + payment.getStatus());
        }
        Payment payment = paymentRepository.findByPaymentCode(paymentCode).orElseThrow();
        return new PaymentStatusResponse(payment.getId(), PaymentStatus.PAID, now);
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> getAllPayments(Pageable pageable) {
        return paymentRepository.findAll(pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public Page<PaymentResponse> getPaymentsByStatus(PaymentStatus status, Pageable pageable) {
        return paymentRepository.findByStatus(status, pageable).map(this::toResponse);
    }

    @Transactional(readOnly = true)
    public java.util.List<PaymentResponse> getPendingPaymentsByAmount(Long amount) {
        return paymentRepository.findPendingByAmount(amount).stream()
                .map(this::toResponse)
                .collect(java.util.stream.Collectors.toList());
    }

    private PaymentResponse toResponse(Payment payment) {
        PaymentResponse response = new PaymentResponse();
        response.setPaymentId(payment.getId());
        response.setOrderId(payment.getOrderId());
        response.setCheckoutOrderId(payment.getCheckoutOrderId());
        response.setPaymentCode(payment.getPaymentCode());
        response.setAmount(payment.getAmount());
        response.setMethod(payment.getMethod());
        response.setStatus(payment.getStatus());
        response.setExpiresAt(payment.getExpiresAt());
        response.setCreatedAt(payment.getCreatedAt());
        response.setSepayTransactionId(payment.getSepayTransactionId());
        response.setSepayGateway(payment.getSepayGateway());
        response.setPaidAt(payment.getPaidAt());

        if (payment.getMethod() == PaymentMethod.QR && payment.getStatus() == PaymentStatus.PENDING) {
            response.setQrUrl(sePayConfig.generateQrUrl(payment.getAmount(), payment.getPaymentCode()));
        }

        return response;
    }
}
