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
