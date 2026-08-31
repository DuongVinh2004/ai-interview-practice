resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "ai-interview-vpc-${var.environment}"
  }
}

resource "aws_internet_gateway" "gw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "ai-interview-igw-${var.environment}"
  }
}

# Public Subnets for ALB
resource "aws_subnet" "public" {
  count                   = length(var.availability_zones)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = {
    Name = "ai-interview-public-subnet-${var.availability_zones[count.index]}-${var.environment}"
    Type = "Public"
  }
}

# Private Application Subnets for ECS Fargate
resource "aws_subnet" "app_private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "ai-interview-app-private-subnet-${var.availability_zones[count.index]}-${var.environment}"
    Type = "PrivateApp"
  }
}

# Private Data Subnets for RDS and ElastiCache
resource "aws_subnet" "data_private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 4)
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "ai-interview-data-private-subnet-${var.availability_zones[count.index]}-${var.environment}"
    Type = "PrivateData"
  }
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = length(var.availability_zones)
  domain = "vpc"

  tags = {
    Name = "ai-interview-nat-eip-${var.availability_zones[count.index]}-${var.environment}"
  }
}

# NAT Gateways for outbound internet connectivity from private app subnets
resource "aws_nat_gateway" "nat" {
  count         = length(var.availability_zones)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "ai-interview-nat-gw-${var.availability_zones[count.index]}-${var.environment}"
  }

  depends_on = [aws_internet_gateway.gw]
}

# Route Tables
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.gw.id
  }

  tags = {
    Name = "ai-interview-public-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "app_private" {
  count  = length(var.availability_zones)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.nat[count.index].id
  }

  tags = {
    Name = "ai-interview-app-private-rt-${var.availability_zones[count.index]}-${var.environment}"
  }
}

resource "aws_route_table_association" "app_private" {
  count          = length(var.availability_zones)
  subnet_id      = aws_subnet.app_private[count.index].id
  route_table_id = aws_route_table.app_private[count.index].id
}

# Security Groups
resource "aws_security_group" "alb" {
  name        = "ai-interview-alb-sg-${var.environment}"
  description = "Security group for external ALB"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTP from Internet"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS from Internet"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Application traffic within the VPC"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  egress {
    description = "Static web traffic within the VPC"
    from_port   = 8080
    to_port     = 8080
    protocol    = "tcp"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  tags = {
    Name = "ai-interview-alb-sg-${var.environment}"
  }
}

resource "aws_security_group" "app" {
  name        = "ai-interview-app-sg-${var.environment}"
  description = "Security group for ECS application containers"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Inbound traffic from ALB only"
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    description     = "Static web traffic from ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  #trivy:ignore:AVD-AWS-0104 ECS tasks require outbound HTTPS to configured AI, email, and billing providers.
  egress {
    description = "HTTPS to configured external providers"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Database, Redis, DNS, and service traffic inside the VPC"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [aws_vpc.main.cidr_block]
  }

  tags = {
    Name = "ai-interview-app-sg-${var.environment}"
  }
}

resource "aws_security_group" "monitoring" {
  name        = "ai-interview-monitoring-sg-${var.environment}"
  description = "Service identity for approved private metrics collectors"
  vpc_id      = aws_vpc.main.id

  tags = {
    Name = "ai-interview-monitoring-sg-${var.environment}"
  }
}

resource "aws_security_group_rule" "metrics_from_monitoring" {
  type                     = "ingress"
  description              = "Authenticated metrics from approved collectors"
  from_port                = 9090
  to_port                  = 9091
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.monitoring.id
  security_group_id        = aws_security_group.app.id
}

resource "aws_security_group_rule" "monitoring_to_metrics" {
  type                     = "egress"
  description              = "Scrape API and worker metrics exporters"
  from_port                = 9090
  to_port                  = 9091
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.app.id
  security_group_id        = aws_security_group.monitoring.id
}

resource "aws_security_group" "db" {
  name        = "ai-interview-db-sg-${var.environment}"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from App Containers"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name = "ai-interview-db-sg-${var.environment}"
  }
}

resource "aws_security_group" "redis" {
  name        = "ai-interview-redis-sg-${var.environment}"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis port from App Containers"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = {
    Name = "ai-interview-redis-sg-${var.environment}"
  }
}
