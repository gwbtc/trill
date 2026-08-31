import type { S3Config } from "@/types/urbit";
import { S3Client } from "@bradenmacdonald/s3-lite-client";

export async function uploadToS3(
  file: File,
  config: S3Config,
): Promise<string> {
  if (
    !config.accessKeyId ||
    !config.secretAccessKey ||
    !config.endpoint ||
    !config.currentBucket
  ) {
    throw new Error("Incomplete S3 configuration");
  }

  const client = new S3Client({
    endPoint: config.endpoint,
    accessKey: config.accessKeyId,
    secretKey: config.secretAccessKey,
    region: config.region || "us-east-1",
  });

  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = file.name.split(".").pop();
  const key = `${timestamp}-${random}.${ext}`;

  // Read file into Uint8Array
  const buffer = await file.arrayBuffer();
  const data = new Uint8Array(buffer);

  // Perform Upload
  await client.putObject(key, data, {
    bucketName: config.currentBucket,
    metadata: {
      "Content-Type": file.type,
      "x-amz-acl": "public-read",
    },
  });

  // Construct URL
  const endpoint = config.endpoint.replace(/^https?:\/\//, "");
  const protocol = config.endpoint.startsWith("http:") ? "http://" : "https://";
  const url = `${protocol}${endpoint}/${config.currentBucket}/${key}`;

  return url;
}
