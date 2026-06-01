package iuh.fit.notificationservice.Service.Impl;

import iuh.fit.notificationservice.Domain.DTO.AccountEvent;
import iuh.fit.notificationservice.Domain.DTO.NotificationResponse;
import iuh.fit.notificationservice.Domain.DTO.OrderStatusEvent;
import iuh.fit.notificationservice.Domain.DTO.SendNotificationRequest;
import iuh.fit.notificationservice.Domain.DTO.SendVerificationEmailRequest;
import iuh.fit.notificationservice.Domain.DTO.VerificationEmailEvent;
import iuh.fit.notificationservice.Domain.Entity.Notification;
import iuh.fit.notificationservice.Domain.Enum.NotificationStatus;
import iuh.fit.notificationservice.Domain.Enum.NotificationType;
import iuh.fit.notificationservice.Domain.Enum.NotificationProvider;
import iuh.fit.notificationservice.Repository.NotificationRepository;
import iuh.fit.notificationservice.Service.EmailTemplateService;
import iuh.fit.notificationservice.Service.NotificationService;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

@Service
public class NotificationServiceImpl implements NotificationService {

    private static final Logger log = LoggerFactory.getLogger(NotificationServiceImpl.class);

    private final NotificationRepository notificationRepository;
    private final EmailTemplateService emailTemplateService;
    private final JavaMailSender mailSender;

    public NotificationServiceImpl(
            NotificationRepository notificationRepository,
            EmailTemplateService emailTemplateService,
            JavaMailSender mailSender) {
        this.notificationRepository = notificationRepository;
        this.emailTemplateService = emailTemplateService;
        this.mailSender = mailSender;
    }

    @Override
    public NotificationResponse sendNotification(SendNotificationRequest request) {
        Notification notification = Notification.builder()
                .userId(request.getUserId())
                .email(request.getRecipientEmail())
                .type(request.getType())
                .subject(request.getSubject() != null ? request.getSubject() : "")
                .channel(request.getChannel())
                .status(NotificationStatus.PENDING)
                .templateName(request.getTemplateName())
                .templateVars(request.getTemplateVars() != null ? request.getTemplateVars() : java.util.Map.of())
                .provider(request.getProvider())
                .scheduledAt(request.getScheduledAt())
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render(
                    request.getTemplateName(),
                    request.getTemplateVars());

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(request.getRecipientEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Email sent successfully to {} for user {}", request.getRecipientEmail(), request.getUserId());

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getRecipientEmail())
                    .status(NotificationStatus.SENT)
                    .message("Email sent successfully")
                    .build();

        } catch (MessagingException e) {
            log.error("Failed to send email to {}: {}", request.getRecipientEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getRecipientEmail())
                    .status(NotificationStatus.FAILED)
                    .message("Failed to send email: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public NotificationResponse sendVerificationEmail(SendVerificationEmailRequest request) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", request.getUserName());
        templateVars.put("verificationCode", request.getVerificationCode());

        Notification notification = Notification.builder()
                .userId(request.getUserId())
                .email(request.getEmail())
                .type(NotificationType.WELCOME)
                .subject("Xác thực email - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("email-verification")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("email-verification", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(request.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Verification email sent to {} for user {}", request.getEmail(), request.getUserId());

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getEmail())
                    .status(NotificationStatus.SENT)
                    .message("Verification email sent successfully")
                    .build();

        } catch (MessagingException e) {
            log.error("Failed to send verification email to {}: {}", request.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            return NotificationResponse.builder()
                    .id(notification.getId())
                    .userId(notification.getUserId())
                    .recipientEmail(request.getEmail())
                    .status(NotificationStatus.FAILED)
                    .message("Failed to send verification email: " + e.getMessage())
                    .build();
        }
    }

    @Override
    public void sendVerificationEmail(VerificationEmailEvent event) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", event.getFullName());
        templateVars.put("verificationCode", event.getVerificationCode());

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .email(event.getEmail())
                .type(NotificationType.WELCOME)
                .subject("Xác thực email - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("email-verification")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("email-verification", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Verification email sent to {} for user {}", event.getEmail(), event.getUserId());

        } catch (MessagingException e) {
            log.error("Failed to send verification email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send verification email", e);
        }
    }

    @Override
    public void sendAccountLockedEmail(AccountEvent event) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", event.getFullName() != null ? event.getFullName() : "bạn");
        templateVars.put("lockReason", event.getLockReason());
        templateVars.put("lockedAt", event.getTimestamp() != null
                ? event.getTimestamp().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
                        .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                : java.time.Instant.now().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
                        .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .email(event.getEmail())
                .type(NotificationType.ACCOUNT_ALERT)
                .subject("Thông báo: Tài khoản của bạn đã bị khóa - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("account-locked")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("account-locked", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Account locked email sent to {} for user {}", event.getEmail(), event.getUserId());

        } catch (MessagingException e) {
            log.error("Failed to send account locked email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send account locked email", e);
        }
    }

    @Override
    public void sendAccountUnlockedEmail(AccountEvent event) {
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("userName", event.getFullName() != null ? event.getFullName() : "bạn");
        templateVars.put("unlockedAt", event.getTimestamp() != null
                ? event.getTimestamp().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
                        .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm"))
                : java.time.Instant.now().atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
                        .format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm")));

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .email(event.getEmail())
                .type(NotificationType.ACCOUNT_ALERT)
                .subject("Thông báo: Tài khoản của bạn đã được mở khóa - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("account-unlocked")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("account-unlocked", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Account unlocked email sent to {} for user {}", event.getEmail(), event.getUserId());

        } catch (MessagingException e) {
            log.error("Failed to send account unlocked email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            throw new RuntimeException("Failed to send account unlocked email", e);
        }
    }

    @Override
    public void sendOrderCreatedEmail(OrderStatusEvent event) {
        if (event.getEmail() == null) {
            log.warn("Order event has no email for orderId {}, skipping", event.getOrderId());
            return;
        }
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("orderId", event.getOrderId() != null ? event.getOrderId().toString() : "N/A");

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .email(event.getEmail())
                .type(NotificationType.ORDER_CONFIRMATION)
                .subject("Xác nhận đơn hàng - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("order-created")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("order-created", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Order created email sent to {} for order {}", event.getEmail(), event.getOrderId());

        } catch (MessagingException e) {
            log.error("Failed to send order created email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            // Don't throw — message is persisted as FAILED, consumer will ack
        }
    }

    @Override
    public void sendOrderPaidEmail(OrderStatusEvent event) {
        if (event.getEmail() == null) {
            log.warn("Order event has no email for orderId {}, skipping", event.getOrderId());
            return;
        }
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("orderId", event.getOrderId() != null ? event.getOrderId().toString() : "N/A");

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .email(event.getEmail())
                .type(NotificationType.ORDER_CONFIRMATION)
                .subject("Thanh toán thành công - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("order-paid")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("order-paid", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Order paid email sent to {} for order {}", event.getEmail(), event.getOrderId());

        } catch (MessagingException e) {
            log.error("Failed to send order paid email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            // Don't throw — message is persisted as FAILED, consumer will ack
        }
    }

    @Override
    public void sendOrderCancelledEmail(OrderStatusEvent event) {
        if (event.getEmail() == null) {
            log.warn("Order event has no email for orderId {}, skipping", event.getOrderId());
            return;
        }
        java.util.Map<String, String> templateVars = new java.util.HashMap<>();
        templateVars.put("orderId", event.getOrderId() != null ? event.getOrderId().toString() : "N/A");

        Notification notification = Notification.builder()
                .userId(event.getUserId())
                .email(event.getEmail())
                .type(NotificationType.ORDER_CONFIRMATION)
                .subject("Đơn hàng đã bị hủy - D4C Clothing Shop")
                .channel(iuh.fit.notificationservice.Domain.Enum.NotificationChannel.EMAIL)
                .status(NotificationStatus.PENDING)
                .templateName("order-cancelled")
                .templateVars(templateVars)
                .provider(NotificationProvider.SMTP)
                .retryCount(0)
                .build();

        notificationRepository.save(notification);

        try {
            String htmlContent = emailTemplateService.render("order-cancelled", templateVars);

            MimeMessage mimeMessage = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(mimeMessage, "UTF-8");
            helper.setTo(event.getEmail());
            helper.setSubject(notification.getSubject());
            helper.setText(htmlContent, true);

            mailSender.send(mimeMessage);

            notification.setStatus(NotificationStatus.SENT);
            notification.setSentAt(LocalDateTime.now());
            notificationRepository.save(notification);

            log.info("Order cancelled email sent to {} for order {}", event.getEmail(), event.getOrderId());

        } catch (MessagingException e) {
            log.error("Failed to send order cancelled email to {}: {}", event.getEmail(), e.getMessage());

            notification.setStatus(NotificationStatus.FAILED);
            notification.setErrorMessage(e.getMessage());
            notificationRepository.save(notification);

            // Don't throw — message is persisted as FAILED, consumer will ack
        }
    }
}
