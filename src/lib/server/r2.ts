import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, NotFound } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const URL_EXPIRY_SECONDS = 5 * 60; // 5 minutes

export function createR2S3Client(env: App.Platform['env']): S3Client {
	return new S3Client({
		region: "auto",
		endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId: env.R2_ACCESS_KEY_ID,
			secretAccessKey: env.R2_SECRET_ACCESS_KEY,
		}
	})
}

export async function createPresignedUploadUrl(
	client: S3Client,
	bucketName: string,
	key: string,
	contentType: string
): Promise<string> {
	return await getSignedUrl(client, new PutObjectCommand({
		Bucket: bucketName,
		Key: key,
		ContentType: contentType,
	}), { expiresIn: URL_EXPIRY_SECONDS })
}

export async function createPresignedDownloadUrl(
	client: S3Client,
	bucketName: string,
	key: string,
	filename: string
): Promise<string> {
	return await getSignedUrl(client,
		new GetObjectCommand({
			Bucket: bucketName,
			Key: key,
			ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`
		}),
		{ expiresIn: URL_EXPIRY_SECONDS }
	)
}

export async function fileExistsInBucket(client: S3Client, bucketName: string, key: string): Promise<boolean> {
	try {
		await client.send(new HeadObjectCommand({ Bucket: bucketName, Key: key }));
	} catch (err) {
		if (err instanceof NotFound) {
			return false;
		}
		throw err;
	}
	return true;
}