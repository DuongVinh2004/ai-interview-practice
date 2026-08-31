output "secrets_arn" {
  value = aws_secretsmanager_secret.app_secrets.arn
}

output "secrets_name" {
  value = aws_secretsmanager_secret.app_secrets.name
}

output "provider_secrets_arn" {
  description = "Operator-managed provider and billing secret container"
  value       = aws_secretsmanager_secret.provider_secrets.arn
}

output "provider_secrets_name" {
  description = "Name populated out-of-band before ECS services start"
  value       = aws_secretsmanager_secret.provider_secrets.name
}

output "kms_key_arn" {
  value = aws_kms_key.app_secrets.arn
}
