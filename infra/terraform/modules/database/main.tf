resource "random_password" "db_password" {
  length  = 32
  special = false
}

resource "aws_db_subnet_group" "main" {
  name       = "ai-interview-db-subnet-group-${var.environment}"
  subnet_ids = var.subnet_ids

  tags = {
    Name = "ai-interview-db-subnet-group-${var.environment}"
  }
}

resource "aws_db_parameter_group" "pg16" {
  name   = "ai-interview-pg16-${var.environment}"
  family = "postgres16"

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = "ai-interview-postgres-${var.environment}"
  engine            = "postgres"
  engine_version    = "16.2"
  instance_class    = var.instance_class
  allocated_storage = 50
  max_allocated_storage = 200
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result

  multi_az               = var.environment == "production" ? true : false
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [var.security_group_id]
  parameter_group_name   = aws_db_parameter_group.pg16.name

  backup_retention_period   = 14
  backup_window             = "18:00-19:00" # UTC
  maintenance_window        = "Sun:20:00-Sun:21:00" # UTC
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production" ? true : false
  skip_final_snapshot       = var.environment == "production" ? false : true
  final_snapshot_identifier = "ai-interview-final-snapshot-${var.environment}"

  auto_minor_version_upgrade = true
  performance_insights_enabled = true
  performance_insights_retention_period = 7

  tags = {
    Name = "ai-interview-rds-postgres-${var.environment}"
  }
}
