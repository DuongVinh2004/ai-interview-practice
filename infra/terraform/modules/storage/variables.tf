variable "environment" {
  type = string
}

variable "allowed_origins" {
  description = "Exact browser origins allowed to upload to or read from application storage"
  type        = list(string)

  validation {
    condition = length(var.allowed_origins) > 0 && alltrue([
      for origin in var.allowed_origins : can(regex("^https://", origin)) && origin != "*"
    ])
    error_message = "allowed_origins must contain at least one explicit HTTPS origin and cannot contain wildcards."
  }
}
