variable "aws_region" {
  description = "AWS region containing the shared release registry and Terraform backend"
  type        = string
  default     = "ap-southeast-1"
}

variable "state_bucket_name" {
  description = "Globally unique S3 bucket name for Terraform state"
  type        = string

  validation {
    condition     = length(var.state_bucket_name) >= 3 && length(var.state_bucket_name) <= 63
    error_message = "state_bucket_name must be a valid 3-63 character S3 bucket name."
  }
}

variable "api_repository_name" {
  description = "Shared immutable API release repository"
  type        = string
  default     = "ai-interview-api"
}

variable "web_repository_name" {
  description = "Shared immutable web release repository"
  type        = string
  default     = "ai-interview-web"
}
