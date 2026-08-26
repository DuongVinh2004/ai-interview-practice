resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_kms_key" "app_storage" {
  description             = "Customer-managed key for AI Interview application storage"
  enable_key_rotation     = true
  deletion_window_in_days = 30

  tags = {
    Name = "ai-interview-storage-kms-${var.environment}"
  }
}

resource "aws_kms_alias" "app_storage" {
  name          = "alias/ai-interview-storage-${var.environment}"
  target_key_id = aws_kms_key.app_storage.key_id
}

resource "aws_s3_bucket" "app_storage" {
  bucket        = "ai-interview-storage-${var.environment}-${random_id.bucket_suffix.hex}"
  force_destroy = var.environment == "production" ? false : true

  tags = {
    Name = "ai-interview-storage-${var.environment}"
  }
}

resource "aws_s3_bucket_versioning" "storage_versioning" {
  bucket = aws_s3_bucket.app_storage.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage_encryption" {
  bucket = aws_s3_bucket.app_storage.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.app_storage.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "storage_pab" {
  bucket = aws_s3_bucket.app_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_cors_configuration" "storage_cors" {
  bucket = aws_s3_bucket.app_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = var.allowed_origins
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "storage_lifecycle" {
  bucket = aws_s3_bucket.app_storage.id

  rule {
    id     = "archive-old-recordings"
    status = "Enabled"

    filter {
      prefix = "recordings/"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }

  rule {
    id     = "expire-user-exports"
    status = "Enabled"

    filter {
      prefix = "exports/"
    }

    expiration {
      days = 7
    }
  }
}
