variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-southeast-1"
}

variable "environment" {
  description = "Deployment environment (staging, production)"
  type        = string
  default     = "production"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
  default     = ["ap-southeast-1a", "ap-southeast-1b"]
}

variable "db_instance_class" {
  description = "RDS PostgreSQL instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "ai_interview_practice"
}

variable "db_username" {
  description = "Master database username"
  type        = string
  default     = "interview_admin"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t4g.small"
}

variable "api_container_cpu" {
  description = "Fargate CPU units for API task"
  type        = number
  default     = 512
}

variable "api_container_memory" {
  description = "Fargate memory (MB) for API task"
  type        = number
  default     = 1024
}

variable "worker_container_cpu" {
  description = "Fargate CPU units for Worker task"
  type        = number
  default     = 512
}

variable "worker_container_memory" {
  description = "Fargate memory (MB) for Worker task"
  type        = number
  default     = 1024
}

variable "domain_name" {
  description = "Custom domain name for ALB"
  type        = string
  default     = "interview.ai.example.com"
}

variable "certificate_arn" {
  description = "ACM certificate ARN used by the public ALB HTTPS listener"
  type        = string
}

variable "frontend_origins" {
  description = "Exact HTTPS origins permitted by the storage CORS policy"
  type        = list(string)
  default     = ["https://interview.ai.example.com"]
}

variable "api_image" {
  description = "Immutable API image reference promoted into this environment"
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.api_image))
    error_message = "api_image must include an immutable sha256 digest."
  }
}

variable "web_image" {
  description = "Immutable web image reference promoted into this environment"
  type        = string

  validation {
    condition     = can(regex("@sha256:[0-9a-f]{64}$", var.web_image))
    error_message = "web_image must include an immutable sha256 digest."
  }
}

variable "ai_daily_budget_usd" {
  description = "Shared UTC-day AI provider budget"
  type        = number
  default     = 50
}

variable "ai_max_provider_call_cost_usd" {
  description = "Per-call amount reserved before dispatching to a paid AI provider"
  type        = number
  default     = 2
}
