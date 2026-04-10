<script lang="ts">
	import { generateThumbnail } from '$lib/thumbnail';

	let status = $state('idle');
	let error = $state('');
	let resultId = $state('');
	let thumbnailCreated = $state(false);
	let thumbnailType = $state('');
	let thumbnailSize = $state(0);
	let thumbnailWidth = $state(0);
	let thumbnailHeight = $state(0);

	async function onFileChange(e: Event) {
		const input = e.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		status = 'generating-thumbnail';
		error = '';

		let thumbBlob: Blob | null = null;
		try {
			thumbBlob = await generateThumbnail(file);
			thumbnailType = thumbBlob.type;
			thumbnailSize = thumbBlob.size;

			// read dimensions
			const bmp = await createImageBitmap(thumbBlob);
			thumbnailWidth = bmp.width;
			thumbnailHeight = bmp.height;
			bmp.close();
		} catch (err) {
			// thumbnail generation failed, continue without
		}

		// presign
		status = 'presigning';
		const presignRes = await fetch('/photos/presign-upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				originalType: file.type,
				...(thumbBlob ? { thumbnailType: thumbBlob.type } : { thumbnailType: 'image/webp' }),
			}),
		});

		if (!presignRes.ok) {
			status = 'error';
			error = `presign failed: ${presignRes.status}`;
			return;
		}

		const presign = await presignRes.json() as {
			id: string;
			originalUploadUrl: string;
			thumbnailUploadUrl: string;
		};

		// upload original
		status = 'uploading-original';
		const origPut = await fetch(presign.originalUploadUrl, {
			method: 'PUT',
			headers: { 'Content-Type': file.type },
			body: file,
		});
		if (!origPut.ok) {
			status = 'error';
			error = `original upload failed: ${origPut.status}`;
			return;
		}

		// upload thumbnail
		status = 'uploading-thumbnail';
		if (thumbBlob) {
			try {
				const thumbPut = await fetch(presign.thumbnailUploadUrl, {
					method: 'PUT',
					headers: { 'Content-Type': thumbBlob.type },
					body: thumbBlob,
				});
				if (!thumbPut.ok) {
					thumbBlob = null;
				}
			} catch {
				thumbBlob = null;
			}
		}

		// confirm
		status = 'confirming';
		const confirmRes = await fetch('/photos/confirm-upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				id: presign.id,
				filename: file.name,
				originalType: file.type,
				...(thumbBlob ? { thumbnailType: thumbBlob.type } : {}),
			}),
		});

		if (!confirmRes.ok) {
			status = 'error';
			error = `confirm failed: ${confirmRes.status}`;
			return;
		}

		const confirm = await confirmRes.json() as {
			id: string;
			originalFilename: string;
			thumbnailCreated: boolean;
		};

		resultId = confirm.id;
		thumbnailCreated = confirm.thumbnailCreated;
		status = 'done';
	}
</script>

<h1>Upload Test</h1>
<input type="file" accept="image/*" data-testid="file-input" onchange={onFileChange} />

<div data-testid="status">{status}</div>
<div data-testid="error">{error}</div>
<div data-testid="result-id">{resultId}</div>
<div data-testid="thumbnail-created">{thumbnailCreated}</div>
<div data-testid="thumbnail-type">{thumbnailType}</div>
<div data-testid="thumbnail-size">{thumbnailSize}</div>
<div data-testid="thumbnail-width">{thumbnailWidth}</div>
<div data-testid="thumbnail-height">{thumbnailHeight}</div>
