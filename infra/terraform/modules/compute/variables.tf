variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "app_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "app_security_group_id" {
  type = string
}

variable "secrets_arn" {
  type = string
}

variable "provider_secrets_arn" {
  description = "Operator-managed AI, payment, and webhook credential secret"
  type        = string
}

variable "secrets_kms_key_arn" {
  type = string
}

variable "certificate_arn" {
  description = "ACM certificate ARN for the public HTTPS listener"
  type        = string

  validation {
    condition     = can(regex("^arn:aws:acm:", var.certificate_arn))
    error_message = "certificate_arn must be a valid ACM certificate ARN."
  }
}

variable "redis_endpoint" {
  type = string
}

variable "s3_bucket_name" {
  type = string
}

variable "storage_kms_key_arn" {
  type = string
}

variable "api_image" {
  description = "Immutable API image reference including an @sha256 digest"
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.api_image))
    error_message = "api_image must end in @sha256:<64 hex chars>."
  }
}

variable "web_image" {
  description = "Immutable web image reference including an @sha256 digest"
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.web_image))
    error_message = "web_image must end in @sha256:<64 hex chars>."
  }
}

variable "frontend_origins" {
  description = "Exact browser origins allowed to send credentialed API requests"
  type        = list(string)

  validation {
    condition     = length(var.frontend_origins) > 0 && alltrue([for origin in var.frontend_origins : startswith(origin, "https://")])
    error_message = "frontend_origins must contain at least one explicit HTTPS origin."
  }
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "worker_cpu" {
  type    = number
  default = 512
}

variable "worker_memory" {
  type    = number
  default = 1024
}

variable "ai_daily_budget_usd" {
  description = "Shared UTC-day provider spend ceiling"
  type        = number
  default     = 50

  validation {
    condition     = var.ai_daily_budget_usd > 0
    error_message = "ai_daily_budget_usd must be positive."
  }
}

variable "ai_max_provider_call_cost_usd" {
  description = "Maximum amount reserved atomically before one paid provider call"
  type        = number
  default     = 2

  validation {
    condition     = var.ai_max_provider_call_cost_usd > 0
    error_message = "ai_max_provider_call_cost_usd must be positive."
  }
}
