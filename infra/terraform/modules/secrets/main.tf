resource "random_password" "jwt_access_secret" {
  length  = 48
  special = false
}

resource "random_password" "jwt_refresh_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "ai-interview-app-secrets-${var.environment}"
  description = "Application configuration secrets for AI Interview Practice"

  tags = {
    Name = "ai-interview-app-secrets-${var.environment}"
  }
}

resource "aws_secretsmanager_secret_version" "app_secrets_val" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    JWT_ACCESS_SECRET  = random_password.jwt_access_secret.result
    JWT_REFRESH_SECRET = random_password.jwt_refresh_secret.result
    DB_PASSWORD        = var.db_password
    REDIS_AUTH_TOKEN   = var.redis_auth_token
    OPENAI_API_KEY     = ""
    ANTHROPIC_API_KEY  = ""
    GEMINI_API_KEY     = ""
  })
}
