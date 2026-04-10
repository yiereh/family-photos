import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const photos = sqliteTable('photos', {
	id: text('id').primaryKey(), // crypto.randomUUID()
	originalKey: text('original_key').notNull(), // R2 bucket key for the original file 
	thumbnailKey: text('thumbnail_key'), // R2 bucket key for the thumbnail (null if client-side generation failed)
	filename: text('filename').notNull(),
	mimeType: text('mime_type').notNull(), // image/jpeg, etc...
	sizeBytes: integer('size_bytes').notNull(),
	uploadedBy: text('uploaded_by'), // Cloudflare Access email address
	description: text('description'),
	uploadedAt: integer('uploaded_at', { mode: 'timestamp' })
		.notNull()
		.$defaultFn(() => new Date())
});
