import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const signPutUrl = async ({ key, contentType, contentLength }) => {
  const cmd = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
  });

  return getSignedUrl(s3, cmd, { expiresIn: 60 });
};

export const signGetUrl = async (key) => {
  const cmd = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(s3, cmd, { expiresIn: 30 });
};

export const objectExists = async (key) => {
  try {
    await s3.send(new HeadObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
};
