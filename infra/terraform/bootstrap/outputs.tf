output "state_bucket_name" {
  description = "Terraform state bucket used by environment stacks"
  value       = aws_s3_bucket.terraform_state.id
}

output "terraform_state_kms_key_arn" {
  description = "KMS key protecting Terraform state and lock data"
  value       = aws_kms_key.terraform_state.arn
}

output "api_ecr_repository_url" {
  description = "Shared immutable API release repository"
  value       = aws_ecr_repository.api.repository_url
}

output "web_ecr_repository_url" {
  description = "Shared immutable web release repository"
  value       = aws_ecr_repository.web.repository_url
}

output "release_registry_kms_key_arn" {
  description = "KMS key protecting immutable release images"
  value       = aws_kms_key.release_registry.arn
}
