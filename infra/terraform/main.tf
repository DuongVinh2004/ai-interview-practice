module "network" {
  source             = "./modules/network"
  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

module "database" {
  source            = "./modules/database"
  environment       = var.environment
  subnet_ids        = module.network.data_private_subnet_ids
  security_group_id = module.network.db_security_group_id
  instance_class    = var.db_instance_class
  db_name           = var.db_name
  db_username       = var.db_username
}

module "redis" {
  source            = "./modules/redis"
  environment       = var.environment
  subnet_ids        = module.network.data_private_subnet_ids
  security_group_id = module.network.redis_security_group_id
  node_type         = var.redis_node_type
}

module "storage" {
  source          = "./modules/storage"
  environment     = var.environment
  allowed_origins = var.frontend_origins
}

module "secrets" {
  source           = "./modules/secrets"
  environment      = var.environment
  db_password      = module.database.db_password
  db_endpoint      = module.database.db_endpoint
  db_username      = module.database.db_username
  db_name          = module.database.db_name
  redis_auth_token = module.redis.auth_token
}

module "compute" {
  source                        = "./modules/compute"
  environment                   = var.environment
  vpc_id                        = module.network.vpc_id
  public_subnet_ids             = module.network.public_subnet_ids
  app_subnet_ids                = module.network.app_private_subnet_ids
  alb_security_group_id         = module.network.alb_security_group_id
  app_security_group_id         = module.network.app_security_group_id
  secrets_arn                   = module.secrets.secrets_arn
  provider_secrets_arn          = module.secrets.provider_secrets_arn
  secrets_kms_key_arn           = module.secrets.kms_key_arn
  certificate_arn               = var.certificate_arn
  redis_endpoint                = module.redis.primary_endpoint
  s3_bucket_name                = module.storage.bucket_name
  storage_kms_key_arn           = module.storage.kms_key_arn
  api_image                     = var.api_image
  web_image                     = var.web_image
  frontend_origins              = var.frontend_origins
  api_cpu                       = var.api_container_cpu
  api_memory                    = var.api_container_memory
  worker_cpu                    = var.worker_container_cpu
  worker_memory                 = var.worker_container_memory
  ai_daily_budget_usd           = var.ai_daily_budget_usd
  ai_max_provider_call_cost_usd = var.ai_max_provider_call_cost_usd
}

# ECR is shared release infrastructure owned by infra/terraform/bootstrap.
# If an earlier experimental state ever contained these module resources,
# forget them without destroying the repositories before importing them into
# the bootstrap state.
removed {
  from = module.compute.aws_ecr_repository.api

  lifecycle {
    destroy = false
  }
}

removed {
  from = module.compute.aws_ecr_repository.web

  lifecycle {
    destroy = false
  }
}

check "provider_call_reservation_fits_daily_budget" {
  assert {
    condition     = var.ai_max_provider_call_cost_usd <= var.ai_daily_budget_usd
    error_message = "ai_max_provider_call_cost_usd must not exceed ai_daily_budget_usd."
  }
}
