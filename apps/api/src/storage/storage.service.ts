import { Injectable, NotFoundException } from "@nestjs/common";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { Readable } from "node:stream";

type UploadInput = {
  contentType: string;
  key: string;
  size: number;
  buffer: Buffer;
};

/**
 * Stores uploaded files.
 * STORAGE_DRIVER=local (default): files live in STORAGE_DIR on the server's disk.
 * STORAGE_DRIVER=s3: files live in any S3-compatible service (S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY).
 */
@Injectable()
export class StorageService {
  private readonly bucketName = process.env.S3_BUCKET?.trim() || "documents";
  private readonly rootDirectory = resolve(process.env.STORAGE_DIR?.trim() || "data/files");
  private readonly s3Client: S3Client | null = process.env.STORAGE_DRIVER?.trim() === "s3" ? createS3Client() : null;
  private bucketReady: Promise<void> | null = null;

  getBucketName() {
    return this.bucketName;
  }

  async uploadBuffer({ contentType, key, size, buffer }: UploadInput) {
    if (this.s3Client) {
      await this.ensureBucket(this.s3Client);
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: buffer,
          ContentLength: size,
          ContentType: contentType
        })
      );
      return;
    }

    const filePath = this.resolveLocalPath(key);
    const temporaryPath = `${filePath}.tmp`;

    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(temporaryPath, buffer);
    await rename(temporaryPath, filePath);
  }

  async getObject(key: string): Promise<Readable> {
    if (this.s3Client) {
      const response = await this.s3Client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: key }));

      if (!response.Body) {
        throw new NotFoundException("Belgenin dosyası bulunamadı.");
      }

      return response.Body as Readable;
    }

    const filePath = this.resolveLocalPath(key);

    try {
      await stat(filePath);
    } catch {
      throw new NotFoundException("Belgenin dosyası bulunamadı.");
    }

    return createReadStream(filePath);
  }

  async removeObject(key: string) {
    if (this.s3Client) {
      await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }));
      return;
    }

    await rm(this.resolveLocalPath(key), { force: true });
  }

  private resolveLocalPath(key: string) {
    const filePath = resolve(this.rootDirectory, key);

    if (!filePath.startsWith(this.rootDirectory + sep)) {
      throw new NotFoundException("Belgenin dosyası bulunamadı.");
    }

    return filePath;
  }

  private ensureBucket(client: S3Client) {
    this.bucketReady ??= client
      .send(new HeadBucketCommand({ Bucket: this.bucketName }))
      .then(() => undefined)
      .catch(() => client.send(new CreateBucketCommand({ Bucket: this.bucketName })).then(() => undefined))
      .catch((error: unknown) => {
        this.bucketReady = null;
        throw error;
      });

    return this.bucketReady;
  }
}

function createS3Client() {
  const endpoint = requireEnv("S3_ENDPOINT");

  return new S3Client({
    endpoint,
    region: process.env.S3_REGION?.trim() || "us-east-1",
    forcePathStyle: true,
    credentials: {
      accessKeyId: requireEnv("S3_ACCESS_KEY"),
      secretAccessKey: requireEnv("S3_SECRET_KEY")
    }
  });
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} must be set when STORAGE_DRIVER=s3.`);
  }

  return value;
}
