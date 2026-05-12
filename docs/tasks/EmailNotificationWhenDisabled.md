# Enhance: Send Email Notification When User Account Is Locked

## Description

Currently, when an account is locked, the user does not receive any notification about the action.

This enhancement will implement an email notification flow so that users are informed whenever their account is locked. The admin performing the lock action must provide a reason, and this reason will be included in the notification email sent to the user.

The implementation involves updates across UI, API, User Service, and Notification Service.

---

# Requirements

## 1. UI Enhancement

### Confirm Dialog Update

- Update the account lock confirmation dialog to include:
  - A required textarea/input field for entering the account lock reason.
  - A list of predefined reason templates.

### Predefined Reason Templates

- The UI should provide several selectable predefined reasons.
- When a predefined reason is selected:
  - The reason input field should automatically be filled with the selected template content.
  - Users can still edit the content before submission.

### Submit Action

- Clicking the **Lock Account** button will:
  - Validate that the reason field is not empty.
  - Submit the lock request together with the lock reason.

---

## 2. API ↔ UI Contract Update

### Request Payload

- Update the lock account API request payload to include:
  - `lockReason` (required)

### Validation

- The API request must be rejected if:
  - `lockReason` is missing.
  - `lockReason` is empty.

---

## 3. API User Service Enhancement

### Lock Account API

- Update the account lock API to accept:
  - `lockReason`

### Event Production

- After the account is successfully locked:
  - Produce an event to RabbitMQ.

### Event Payload

The event must contain:

- User email
- Account lock reason
- Event timestamp (optional but recommended)

### Event Type

- Introduce a dedicated event for account lock notification.
- Example:
  - `USER_ACCOUNT_LOCKED`

---

## 4. API Notification Service Enhancement

### RabbitMQ Consumer

- Consume the account lock event produced by the User Service.

### Email Notification

- Extract:
  - User email
  - Lock reason

- Send an email notification to the user informing them that:
  - Their account has been locked.
  - The reason for the account lock.

### Email Content

The email should include:

- Notification that the account has been locked
- Lock reason
- Support contact information (if available)

---

# Acceptance Criteria

## UI

- [ ] The lock account confirmation dialog contains a required reason input field.
- [ ] The dialog displays predefined reason templates.
- [ ] Selecting a template auto-fills the reason field.
- [ ] Users can modify the auto-filled reason before submission.
- [ ] Submitting without a reason is not allowed.

## API ↔ UI

- [ ] The lock account API accepts `lockReason`.
- [ ] API validation rejects requests with missing or empty `lockReason`.

## API User Service

- [ ] The account lock API stores/processes the provided lock reason.
- [ ] A RabbitMQ event is produced after successful account lock.
- [ ] The produced event contains user email and lock reason.

## API Notification Service

- [ ] The notification service successfully consumes the account lock event.
- [ ] An email is sent to the locked user.
- [ ] The email contains the provided lock reason.

## End-to-End

- [ ] When an admin locks a user account with a reason, the user receives an email notification containing the lock reason.
