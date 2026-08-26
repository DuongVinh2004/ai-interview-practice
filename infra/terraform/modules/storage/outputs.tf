output "bucket_name" {
  value = aws_s3_bucket.app_storage.id
}

output "bucket_arn" {
  value = aws_s3_bucket.app_storage.arn
}

output "kms_key_arn" {
  value = aws_kms_key.app_storage.arn
}
