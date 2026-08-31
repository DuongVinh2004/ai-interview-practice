data "aws_caller_identity" "current" {}

data "aws_region" "current" {}

resource "aws_ecs_cluster" "main" {
  name = "ai-interview-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "ai-interview-cluster-${var.environment}"
  }
}

resource "aws_kms_key" "cloudwatch_logs" {
  description             = "Customer-managed encryption key for ECS CloudWatch logs"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnableAccountAdministration"
        Effect    = "Allow"
        Principal = { AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root" }
        Action    = "kms:*"
        Resource  = "*"
      },
      {
        Sid       = "AllowCloudWatchLogs"
        Effect    = "Allow"
        Principal = { Service = "logs.${data.aws_region.current.name}.amazonaws.com" }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:Describe*"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:log-group:/ecs/ai-interview-*"
          }
        }
      }
    ]
  })

  tags = {
    Name = "ai-interview-cloudwatch-kms-${var.environment}"
  }
}

resource "aws_kms_alias" "cloudwatch_logs" {
  name          = "alias/ai-interview-cloudwatch-${var.environment}"
  target_key_id = aws_kms_key.cloudwatch_logs.key_id
}

# CloudWatch Log Groups
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/ai-interview-api-${var.environment}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.cloudwatch_logs.arn
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/ai-interview-worker-${var.environment}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.cloudwatch_logs.arn
}

resource "aws_cloudwatch_log_group" "web" {
  name              = "/ecs/ai-interview-web-${var.environment}"
  retention_in_days = 30
  kms_key_id        = aws_kms_key.cloudwatch_logs.arn
}

# IAM Roles for ECS Execution & Task
resource "aws_iam_role" "ecs_execution_role" {
  name = "ai-interview-ecs-execution-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution_policy" {
  role       = aws_iam_role.ecs_execution_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "secrets_access" {
  name = "ai-interview-secrets-access-${var.environment}"
  role = aws_iam_role.ecs_execution_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [var.secrets_arn, var.provider_secrets_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [var.secrets_kms_key_arn]
      }
    ]
  })
}

resource "random_id" "alb_logs_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "ai-interview-alb-logs-${var.environment}-${random_id.alb_logs_suffix.hex}"
  force_destroy = false

  tags = {
    Name = "ai-interview-alb-logs-${var.environment}"
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

#trivy:ignore:AVD-AWS-0132 S3 access-log delivery does not support SSE-KMS destination buckets.
resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "expire-alb-access-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowLoadBalancerLogDelivery"
        Effect    = "Allow"
        Principal = { Service = "logdelivery.elasticloadbalancing.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      },
      {
        Sid       = "AllowLoadBalancerAclCheck"
        Effect    = "Allow"
        Principal = { Service = "logdelivery.elasticloadbalancing.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.alb_logs.arn
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task_role" {
  name = "ai-interview-ecs-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = [var.secrets_kms_key_arn]
      }
    ]
  })
}

resource "random_id" "alb_logs_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "ai-interview-alb-logs-${var.environment}-${random_id.alb_logs_suffix.hex}"
  force_destroy = false

  tags = {
    Name = "ai-interview-alb-logs-${var.environment}"
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

#trivy:ignore:AVD-AWS-0132 S3 access-log delivery does not support SSE-KMS destination buckets.
resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "expire-alb-access-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 90
    }
  }
}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowLoadBalancerLogDelivery"
        Effect    = "Allow"
        Principal = { Service = "logdelivery.elasticloadbalancing.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      },
      {
        Sid       = "AllowLoadBalancerAclCheck"
        Effect    = "Allow"
        Principal = { Service = "logdelivery.elasticloadbalancing.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.alb_logs.arn
      }
    ]
  })
}

resource "aws_iam_role" "api_task_role" {
  name = "ai-interview-api-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role" "worker_task_role" {
  name = "ai-interview-worker-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role" "web_task_role" {
  name = "ai-interview-web-task-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

# S3 Access for API Task Role Only (Synchronous storage operations)
resource "aws_iam_role_policy" "api_s3_access" {
  name = "ai-interview-api-s3-access-${var.environment}"
  role = aws_iam_role.api_task_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = ["arn:aws:s3:::${var.s3_bucket_name}/*"]
      },
      {
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey"
        ]
# Application Load Balancer
resource "aws_lb" "main" {
  name = "ai-interview-alb-${var.environment}"
  #trivy:ignore:AVD-AWS-0053 This is the intentionally public HTTPS entrypoint; ECS tasks remain private.
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [var.alb_security_group_id]
  subnets                    = var.public_subnet_ids
  drop_invalid_header_fields = true

  enable_deletion_protection = var.environment == "production" ? true : false

  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]

  tags = {
    Name = "ai-interview-alb-${var.environment}"
  }
}

resource "aws_lb_target_group" "api" {
  name        = "ai-interview-api-tg-${var.environment}"
  port        = 3001
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/v1/health/ready"
    port                = "3001"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "web" {
  name        = "ai-interview-web-tg-${var.environment}"
  port        = 8080
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/"
    port                = "8080"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "deny_public_metrics" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 1

  action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not Found"
      status_code  = "404"
    }
  }

  condition {
    path_pattern {
      values = ["/api/v1/metrics", "/api/v1/metrics/*"]
    }
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }

  condition {
    path_pattern {
      values = ["/api/*"]
    }
  }
}

# ECS Task Definition: API
resource "aws_ecs_task_definition" "api" {
  family                   = "ai-interview-api-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.api_cpu
  memory                   = var.api_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.api_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.api_image
      essential = true
      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://127.0.0.1:3001/api/v1/health/ready || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
      portMappings = [
        {
          containerPort = 3001
          hostPort      = 3001
          protocol      = "tcp"
        },
        {
          containerPort = 9091
          hostPort      = 9091
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PROCESS_ROLE", value = "api" },
        { name = "PORT", value = "3001" },
        { name = "API_PREFIX", value = "/api/v1" },
        { name = "CORS_ORIGIN", value = join(",", var.frontend_origins) },
        { name = "AI_PROVIDER", value = "router" },
        { name = "AI_PROVIDER_PRIORITY", value = "gemini,openai,anthropic" },
        { name = "AI_ALLOW_MOCK", value = "false" },
        { name = "ALLOW_MOCK_PROVIDERS", value = "false" },
        { name = "AI_BUDGET_DAILY_USD", value = tostring(var.ai_daily_budget_usd) },
        { name = "AI_MAX_PROVIDER_CALL_COST_USD", value = tostring(var.ai_max_provider_call_cost_usd) },
        { name = "METRICS_EXPORTER_ENABLED", value = "true" },
        { name = "METRICS_EXPORTER_HOST", value = "0.0.0.0" },
        { name = "METRICS_EXPORTER_PORT", value = "9091" },
        { name = "REDIS_HOST", value = var.redis_endpoint },
        { name = "REDIS_PORT", value = "6379" },
        { name = "REDIS_TLS", value = "true" },
        { name = "STORAGE_PROVIDER", value = "s3" },
        { name = "AWS_S3_BUCKET", value = var.s3_bucket_name }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.secrets_arn}:DATABASE_URL::" },
        { name = "REDIS_PASSWORD", valueFrom = "${var.secrets_arn}:REDIS_PASSWORD::" },
        { name = "JWT_ACCESS_SECRET", valueFrom = "${var.secrets_arn}:JWT_ACCESS_SECRET::" },
        { name = "JWT_REFRESH_SECRET", valueFrom = "${var.secrets_arn}:JWT_REFRESH_SECRET::" },
        { name = "MFA_ENCRYPTION_KEY", valueFrom = "${var.secrets_arn}:MFA_ENCRYPTION_KEY::" },
        { name = "CERTIFICATE_SECRET", valueFrom = "${var.secrets_arn}:CERTIFICATE_SECRET::" },
        { name = "METRICS_AUTH_TOKEN", valueFrom = "${var.secrets_arn}:METRICS_AUTH_TOKEN::" },
        { name = "OPENAI_API_KEY", valueFrom = "${var.provider_secrets_arn}:OPENAI_API_KEY::" },
        { name = "ANTHROPIC_API_KEY", valueFrom = "${var.provider_secrets_arn}:ANTHROPIC_API_KEY::" },
        { name = "GEMINI_API_KEY", valueFrom = "${var.provider_secrets_arn}:GEMINI_API_KEY::" },
        { name = "PAYOS_CLIENT_ID", valueFrom = "${var.provider_secrets_arn}:PAYOS_CLIENT_ID::" },
        { name = "PAYOS_API_KEY", valueFrom = "${var.provider_secrets_arn}:PAYOS_API_KEY::" },
        { name = "PAYOS_CHECKSUM_KEY", valueFrom = "${var.provider_secrets_arn}:PAYOS_CHECKSUM_KEY::" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${var.provider_secrets_arn}:STRIPE_SECRET_KEY::" },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "${var.provider_secrets_arn}:STRIPE_WEBHOOK_SECRET::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = "ap-southeast-1"
          "awslogs-stream-prefix" = "api"
        }
        { name = "AI_PROVIDER", value = "router" },
        { name = "AI_PROVIDER_PRIORITY", value = "gemini,openai,anthropic" },
        { name = "AI_ALLOW_MOCK", value = "false" },
        { name = "ALLOW_MOCK_PROVIDERS", value = "false" },
        { name = "AI_BUDGET_DAILY_USD", value = tostring(var.ai_daily_budget_usd) },
        { name = "AI_MAX_PROVIDER_CALL_COST_USD", value = tostring(var.ai_max_provider_call_cost_usd) },
        { name = "METRICS_EXPORTER_ENABLED", value = "true" },
        { name = "METRICS_EXPORTER_HOST", value = "0.0.0.0" },
        { name = "METRICS_EXPORTER_PORT", value = "9091" },
        { name = "REDIS_HOST", value = var.redis_endpoint },
        { name = "REDIS_PORT", value = "6379" },
        { name = "REDIS_TLS", value = "true" },
        { name = "STORAGE_PROVIDER", value = "s3" },
        { name = "AWS_S3_BUCKET", value = var.s3_bucket_name }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.secrets_arn}:DATABASE_URL::" },
        { name = "REDIS_PASSWORD", valueFrom = "${var.secrets_arn}:REDIS_PASSWORD::" },
        { name = "JWT_ACCESS_SECRET", valueFrom = "${var.secrets_arn}:JWT_ACCESS_SECRET::" },
        { name = "JWT_REFRESH_SECRET", valueFrom = "${var.secrets_arn}:JWT_REFRESH_SECRET::" },
        { name = "MFA_ENCRYPTION_KEY", valueFrom = "${var.secrets_arn}:MFA_ENCRYPTION_KEY::" },
        { name = "CERTIFICATE_SECRET", valueFrom = "${var.secrets_arn}:CERTIFICATE_SECRET::" },
        { name = "METRICS_AUTH_TOKEN", valueFrom = "${var.secrets_arn}:METRICS_AUTH_TOKEN::" },
        { name = "OPENAI_API_KEY", valueFrom = "${var.provider_secrets_arn}:OPENAI_API_KEY::" },
        { name = "ANTHROPIC_API_KEY", valueFrom = "${var.provider_secrets_arn}:ANTHROPIC_API_KEY::" },
        { name = "GEMINI_API_KEY", valueFrom = "${var.provider_secrets_arn}:GEMINI_API_KEY::" },
        { name = "PAYOS_CLIENT_ID", valueFrom = "${var.provider_secrets_arn}:PAYOS_CLIENT_ID::" },
        { name = "PAYOS_API_KEY", valueFrom = "${var.provider_secrets_arn}:PAYOS_API_KEY::" },
        { name = "PAYOS_CHECKSUM_KEY", valueFrom = "${var.provider_secrets_arn}:PAYOS_CHECKSUM_KEY::" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${var.provider_secrets_arn}:STRIPE_SECRET_KEY::" },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "${var.provider_secrets_arn}:STRIPE_WEBHOOK_SECRET::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = "ap-southeast-1"
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

# ECS Task Definition: Worker
resource "aws_ecs_task_definition" "worker" {
  family                   = "ai-interview-worker-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.worker_cpu
  memory                   = var.worker_memory
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.worker_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "worker"
      image     = var.api_image
      command   = ["node", "apps/api/dist/worker.js"]
      essential = true
      healthCheck = {
        command     = ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://127.0.0.1:9090/health/ready || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
      portMappings = [
        {
          containerPort = 9090
          hostPort      = 9090
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "PROCESS_ROLE", value = "worker" },
        { name = "CORS_ORIGIN", value = join(",", var.frontend_origins) },
        { name = "AI_PROVIDER", value = "router" },
        { name = "AI_PROVIDER_PRIORITY", value = "gemini,openai,anthropic" },
        { name = "AI_ALLOW_MOCK", value = "false" },
        { name = "ALLOW_MOCK_PROVIDERS", value = "false" },
        { name = "AI_BUDGET_DAILY_USD", value = tostring(var.ai_daily_budget_usd) },
        { name = "AI_MAX_PROVIDER_CALL_COST_USD", value = tostring(var.ai_max_provider_call_cost_usd) },
        { name = "METRICS_EXPORTER_ENABLED", value = "true" },
        { name = "METRICS_EXPORTER_HOST", value = "0.0.0.0" },
        { name = "METRICS_EXPORTER_PORT", value = "9090" },
        { name = "REDIS_HOST", value = var.redis_endpoint },
        { name = "REDIS_PORT", value = "6379" },
        { name = "REDIS_TLS", value = "true" },
        { name = "STORAGE_PROVIDER", value = "s3" },
        { name = "AWS_S3_BUCKET", value = var.s3_bucket_name }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = "${var.secrets_arn}:DATABASE_URL::" },
        { name = "REDIS_PASSWORD", valueFrom = "${var.secrets_arn}:REDIS_PASSWORD::" },
        { name = "JWT_ACCESS_SECRET", valueFrom = "${var.secrets_arn}:JWT_ACCESS_SECRET::" },
        { name = "JWT_REFRESH_SECRET", valueFrom = "${var.secrets_arn}:JWT_REFRESH_SECRET::" },
        { name = "MFA_ENCRYPTION_KEY", valueFrom = "${var.secrets_arn}:MFA_ENCRYPTION_KEY::" },
        { name = "CERTIFICATE_SECRET", valueFrom = "${var.secrets_arn}:CERTIFICATE_SECRET::" },
        { name = "METRICS_AUTH_TOKEN", valueFrom = "${var.secrets_arn}:METRICS_AUTH_TOKEN::" },
        { name = "OPENAI_API_KEY", valueFrom = "${var.provider_secrets_arn}:OPENAI_API_KEY::" },
        { name = "ANTHROPIC_API_KEY", valueFrom = "${var.provider_secrets_arn}:ANTHROPIC_API_KEY::" },
        { name = "GEMINI_API_KEY", valueFrom = "${var.provider_secrets_arn}:GEMINI_API_KEY::" },
        { name = "PAYOS_CLIENT_ID", valueFrom = "${var.provider_secrets_arn}:PAYOS_CLIENT_ID::" },
        { name = "PAYOS_API_KEY", valueFrom = "${var.provider_secrets_arn}:PAYOS_API_KEY::" },
        { name = "PAYOS_CHECKSUM_KEY", valueFrom = "${var.provider_secrets_arn}:PAYOS_CHECKSUM_KEY::" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${var.provider_secrets_arn}:STRIPE_SECRET_KEY::" },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "${var.provider_secrets_arn}:STRIPE_WEBHOOK_SECRET::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.worker.name
          "awslogs-region"        = "ap-southeast-1"
          "awslogs-stream-prefix" = "worker"
        }
      }
    }
  ])
}

# ECS Task Definition: Web
resource "aws_ecs_task_definition" "web" {
  family                   = "ai-interview-web-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = 256
  memory                   = 512
  execution_role_arn       = aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.web_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = var.web_image
      essential = true
      healthCheck = {
        command     = ["CMD-SHELL", "wget --quiet --output-document=/dev/null http://127.0.0.1:8080/ || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 15
      }
      portMappings = [
        {
          containerPort = 8080
          hostPort      = 8080
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.web.name
          "awslogs-region"        = data.aws_region.current.name
          "awslogs-stream-prefix" = "web"
        }
      }
    }
  ])
}

# ECS Service: API
resource "aws_ecs_service" "api" {
  name            = "ai-interview-api-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.app_subnet_ids
    security_groups  = [var.app_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3001
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    # CD owns release revisions; autoscaling owns desired count. A later
    # infrastructure apply must not silently roll either back.
    ignore_changes = [task_definition, desired_count]
  }
}

# ECS Service: Worker
resource "aws_ecs_service" "worker" {
  name            = "ai-interview-worker-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = var.app_subnet_ids
    security_groups  = [var.app_security_group_id]
    assign_public_ip = false
  }

  lifecycle {
    ignore_changes = [task_definition, desired_count]
  }
}

# ECS Service: Web
resource "aws_ecs_service" "web" {
  name            = "ai-interview-web-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.web.arn
  desired_count   = var.environment == "production" ? 2 : 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.app_subnet_ids
    security_groups  = [var.app_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 8080
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  lifecycle {
    # CD owns release revisions; autoscaling owns desired count. A later
    # infrastructure apply must not silently roll either back.
    ignore_changes = [task_definition, desired_count]
  }
}

# Auto-scaling for API
resource "aws_appautoscaling_target" "api_target" {
  max_capacity       = 10
  min_capacity       = var.environment == "production" ? 2 : 1
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "api_cpu_policy" {
  name               = "ai-interview-api-cpu-scaling-${var.environment}"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.api_target.resource_id
  scalable_dimension = aws_appautoscaling_target.api_target.scalable_dimension
  service_namespace  = aws_appautoscaling_target.api_target.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70.0
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
