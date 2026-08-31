output "vpc_id" {
  description = "VPC Identifier"
  value       = module.network.vpc_id
}

output "alb_dns_name" {
  description = "Application Load Balancer DNS Name"
  value       = module.compute.alb_dns_name
}

output "database_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.database.db_endpoint
  sensitive   = true
}

output "redis_primary_endpoint" {
  description = "ElastiCache Redis primary endpoint"
  value       = module.redis.primary_endpoint
  sensitive   = true
}

output "storage_bucket_name" {
  description = "S3 storage bucket for recordings and exports"
  value       = module.storage.bucket_name
}

output "secrets_manager_arn" {
  description = "AWS Secrets Manager ARN for application secrets"
  value       = module.secrets.secrets_arn
}

output "provider_secrets_manager_arn" {
  description = "Operator-managed AI, payment, and webhook secret container"
  value       = module.secrets.provider_secrets_arn
}
output "monitoring_security_group_id" {
  description = "Security group identity for approved private metrics collectors"
  value       = module.network.monitoring_security_group_id
}

output "api_ecr_repository_url" {
  description = "Immutable API release repository derived from the approved image"
  value       = split("@", var.api_image)[0]
}

output "web_ecr_repository_url" {
  description = "Immutable web release repository derived from the approved image"
  value       = split("@", var.web_image)[0]
}
