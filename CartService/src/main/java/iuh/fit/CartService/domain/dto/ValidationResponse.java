package iuh.fit.CartService.domain.dto;

import java.util.List;

public class ValidationResponse {

    private boolean valid;
    private List<ValidationError> errors;

    public ValidationResponse() {}

    public boolean isValid() { return valid; }
    public void setValid(boolean valid) { this.valid = valid; }
    public List<ValidationError> getErrors() { return errors; }
    public void setErrors(List<ValidationError> errors) { this.errors = errors; }

    public static ValidationResponseBuilder builder() {
        return new ValidationResponseBuilder();
    }

    public static class ValidationResponseBuilder {
        private boolean valid;
        private List<ValidationError> errors;

        ValidationResponseBuilder() {}

        public ValidationResponseBuilder valid(boolean valid) { this.valid = valid; return this; }
        public ValidationResponseBuilder errors(List<ValidationError> errors) { this.errors = errors; return this; }
        public ValidationResponse build() {
            ValidationResponse r = new ValidationResponse();
            r.valid = valid; r.errors = errors;
            return r;
        }
    }

    public static class ValidationError {
        private String variantId;
        private String reason;
        private String message;

        public ValidationError() {}

        public String getVariantId() { return variantId; }
        public void setVariantId(String variantId) { this.variantId = variantId; }
        public String getReason() { return reason; }
        public void setReason(String reason) { this.reason = reason; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public static ValidationErrorBuilder builder() { return new ValidationErrorBuilder(); }

        public static class ValidationErrorBuilder {
            private String variantId; private String reason; private String message;

            ValidationErrorBuilder() {}

            public ValidationErrorBuilder variantId(String variantId) { this.variantId = variantId; return this; }
            public ValidationErrorBuilder reason(String reason) { this.reason = reason; return this; }
            public ValidationErrorBuilder message(String message) { this.message = message; return this; }
            public ValidationError build() {
                ValidationError e = new ValidationError();
                e.variantId = variantId; e.reason = reason; e.message = message;
                return e;
            }
        }
    }
}
