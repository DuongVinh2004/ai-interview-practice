output "secrets_arn" {
  value = aws_secretsmanager_secret.app_secrets.arn
}

output "secrets_name" {
  value = aws_secretsmanager_secret.app_secrets.name
}

output "kms_key_arn" {
  value = aws_kms_key.app_secrets.arn
}
