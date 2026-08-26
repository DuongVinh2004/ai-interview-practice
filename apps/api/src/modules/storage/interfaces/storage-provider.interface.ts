export interface ObjectMetadata {
  size: number;
  contentType: string;
  lastModified: Date;
}

export interface StorageProvider {
  /**
   * Name/identifier of the storage provider
   */
  readonly name: string;

  /**
   * Generates a presigned URL for direct-to-cloud upload
   */
  generatePresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds?: number,
  ): Promise<string>;

  /**
   * Generates a presigned URL for downloading private objects
   */
  generatePresignedDownloadUrl(key: string, expiresInSeconds?: number): Promise<string>;

  /**
   * Deletes an object from storage bucket
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Gets metadata about an object
   */
  getObjectMetadata(key: string): Promise<ObjectMetadata | null>;
}
