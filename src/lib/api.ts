import { z } from 'zod';

// --- POST /photos/presign-upload ---

export const PresignUploadRequest = z.object({
	originalType: z.string(),
	thumbnailType: z.enum(['image/webp', 'image/jpeg']),
});

export const PresignUploadResponse = z.object({
	id: z.string(),
	originalUploadUrl: z.string(),
	thumbnailUploadUrl: z.string(),
	expiresIn: z.number(),
});

// --- POST /photos/confirm-upload ---

export const ConfirmUploadRequest = z.object({
	id: z.string(),
	filename: z.string(),
	originalType: z.string().default('application/octet-stream'),
	thumbnailType: z.string().optional(),
	description: z.string().optional(),
});

export const ConfirmUploadResponse = z.object({
	id: z.string(),
	originalFilename: z.string(),
	thumbnailCreated: z.boolean(),
});

// --- POST /photos/batch-delete ---

export const BatchDeleteRequest = z.object({
	ids: z.array(z.string()),
});

export const BatchDeleteResponse = z.object({
	deleted: z.array(z.string()),
});

// --- DELETE /photos/:id ---

export const DeletePhotoResponse = z.object({
	deleted: z.string(),
});

// --- GET /photos ---

export const PhotoItem = z.object({
	id: z.string(),
	originalKey: z.string(),
	thumbnailKey: z.string().nullable(),
	filename: z.string(),
	mimeType: z.string(),
	sizeBytes: z.number(),
	uploadedBy: z.string().nullable(),
	description: z.string().nullable(),
	uploadedAt: z.number(),
});

export const ListPhotosResponse = z.object({
	items: z.array(PhotoItem),
	nextCursor: z.string().nullable(),
});

// --- Inferred types ---

export type PresignUploadRequest = z.infer<typeof PresignUploadRequest>;
export type PresignUploadResponse = z.infer<typeof PresignUploadResponse>;
export type ConfirmUploadRequest = z.infer<typeof ConfirmUploadRequest>;
export type ConfirmUploadResponse = z.infer<typeof ConfirmUploadResponse>;
export type BatchDeleteRequest = z.infer<typeof BatchDeleteRequest>;
export type BatchDeleteResponse = z.infer<typeof BatchDeleteResponse>;
export type DeletePhotoResponse = z.infer<typeof DeletePhotoResponse>;
export type PhotoItem = z.infer<typeof PhotoItem>;
export type ListPhotosResponse = z.infer<typeof ListPhotosResponse>;
