resource "random_password" "jwt_access_secret" {
  length  = 48
  special = false
}

resource "random_password" "jwt_refresh_secret" {
  length  = 48
  special = false
}

resource "random_password" "mfa_encryption_key" {
  length  = 48
  special = false
}

resource "random_password" "certificate_secret" {
  length  = 48
  special = false
}

resource "random_password" "metrics_auth_token" {
  length  = 48
  special = false
}

resource "aws_kms_key" "app_secrets" {
  description             = "Customer-managed encryption key for AI Interview application secrets"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  tags = {
    Name = "ai-interview-secrets-kms-${var.environment}"
  }
}

resource "aws_kms_alias" "app_secrets" {
  name          = "alias/ai-interview-secrets-${var.environment}"
  target_key_id = aws_kms_key.app_secrets.key_id
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "ai-interview-app-secrets-${var.environment}"
  description = "Terraform-managed runtime secrets for AI Interview Practice"
  kms_key_id  = aws_kms_key.app_secrets.arn

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "ai-interview-app-secrets-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets_val" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    JWT_ACCESS_SECRET  = random_password.jwt_access_secret.result
    JWT_REFRESH_SECRET = random_password.jwt_refresh_secret.result
    MFA_ENCRYPTION_KEY = random_password.mfa_encryption_key.result
    CERTIFICATE_SECRET = random_password.certificate_secret.result
    METRICS_AUTH_TOKEN = random_password.metrics_auth_token.result
    DATABASE_URL       = "postgresql://${var.db_username}:${urlencode(var.db_password)}@${var.db_endpoint}/${var.db_name}?schema=public&sslmode=require"
    REDIS_PASSWORD     = var.redis_auth_token
  })
}

resource "aws_secretsmanager_secret" "provider_secrets" {
  name        = "ai-interview-provider-secrets-${var.environment}"
  description = "Operator-managed AI, payment, and webhook credentials"
  kms_key_id  = aws_kms_key.app_secrets.arn

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Name = "ai-interview-provider-secrets-${var.environment}"
  }
}
