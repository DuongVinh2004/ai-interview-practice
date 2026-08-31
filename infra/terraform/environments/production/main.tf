terraform {
  required_version = ">= 1.10.0"
  backend "s3" {}
}

variable "certificate_arn" {
  description = "Production ACM certificate ARN"
  type        = string
}

variable "api_image" {
  description = "Approved API image reference including its sha256 digest"
  type        = string
}

variable "web_image" {
  description = "Approved web image reference including its sha256 digest"
  type        = string
}

module "production_platform" {
  source = "../../"

  environment             = "production"
  aws_region              = "ap-southeast-1"
  vpc_cidr                = "10.0.0.0/16"
  availability_zones      = ["ap-southeast-1a", "ap-southeast-1b"]
  db_instance_class       = "db.t4g.medium"
  redis_node_type         = "cache.t4g.small"
  api_container_cpu       = 512
  api_container_memory    = 1024
  worker_container_cpu    = 512
  worker_container_memory = 1024
  certificate_arn         = var.certificate_arn
  frontend_origins        = ["https://interview.ai.example.com"]
  api_image               = var.api_image
  web_image               = var.web_image
}
