resource "random_password" "redis_auth_token" {
  length  = 32
  special = false
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "ai-interview-redis-subnet-group-${var.environment}"
  subnet_ids = var.subnet_ids
}

resource "aws_elasticache_parameter_group" "redis7" {
  name   = "ai-interview-redis7-${var.environment}"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "noeviction"
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "ai-interview-redis-${var.environment}"
  description          = "Redis replication group for BullMQ and Caching"
  node_type            = var.node_type
  port                 = 6379
  parameter_group_name = aws_elasticache_parameter_group.redis7.name
  subnet_group_name    = aws_elasticache_subnet_group.main.name
  security_group_ids   = [var.security_group_id]

  num_cache_clusters         = var.environment == "production" ? 2 : 1
  automatic_failover_enabled = var.environment == "production" ? true : false
  multi_az_enabled           = var.environment == "production" ? true : false

  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = random_password.redis_auth_token.result

  snapshot_retention_limit = 7
  snapshot_window          = "17:00-18:00"
  maintenance_window       = "Sun:21:00-Sun:22:00"

  tags = {
    Name = "ai-interview-redis-${var.environment}"
  }
}
