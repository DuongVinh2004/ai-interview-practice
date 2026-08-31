terraform {
  required_version = ">= 1.10.0"

  # First apply uses `terraform init -backend=false`; immediately afterward,
  # migrate the bootstrap state into the newly created protected bucket.
  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.100"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "AI-IT-Interview"
      ManagedBy = "Terraform"
      Scope     = "SharedBootstrap"
    }
  }
}
