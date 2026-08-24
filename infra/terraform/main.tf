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
  source      = "./modules/storage"
  environment = var.environment
}

module "secrets" {
  source           = "./modules/secrets"
  environment      = var.environment
  db_password      = module.database.db_password
  redis_auth_token = module.redis.auth_token
}

module "compute" {
  source                = "./modules/compute"
  environment           = var.environment
  vpc_id                = module.network.vpc_id
  public_subnet_ids     = module.network.public_subnet_ids
  app_subnet_ids        = module.network.app_private_subnet_ids
  alb_security_group_id = module.network.alb_security_group_id
  app_security_group_id = module.network.app_security_group_id
  secrets_arn           = module.secrets.secrets_arn
  db_endpoint           = module.database.db_endpoint
  redis_endpoint        = module.redis.primary_endpoint
  s3_bucket_name        = module.storage.bucket_name
  api_cpu               = var.api_container_cpu
  api_memory            = var.api_container_memory
  worker_cpu            = var.worker_container_cpu
  worker_memory         = var.worker_container_memory
}
