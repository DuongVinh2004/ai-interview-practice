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

variable "db_endpoint" {
  type = string
}

variable "redis_endpoint" {
  type = string
}

variable "s3_bucket_name" {
  type = string
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

variable "jwt_access_secret" {
  type      = string
  sensitive = true
  default   = "production-jwt-access-secret-min-32-chars-override"
}

variable "jwt_refresh_secret" {
  type      = string
  sensitive = true
  default   = "production-jwt-refresh-secret-min-32-chars-override"
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  type      = string
  sensitive = true
  default   = ""
}

variable "db_name" {
  type    = string
  default = "ai_interview_practice"
}

variable "redis_auth_token" {
  type      = string
  sensitive = true
  default   = ""
}
