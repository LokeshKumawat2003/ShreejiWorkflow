const MAX_WIDTH = 600;
const MAX_HEIGHT = 200;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function loadImage(file: File) {
	return new Promise<HTMLImageElement>((resolve, reject) => {
		const url = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(url);
			resolve(image);
		};
		image.onerror = () => {
			URL.revokeObjectURL(url);
			reject(new Error('This file could not be read as an image.'));
		};
		image.src = url;
	});
}

/** Scales a signature photo/scan down to a small PNG before it is uploaded to Cloudinary. */
export async function prepareSignatureImage(file: File) {
	if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Choose a PNG or JPG image of the signature.');
	if (file.size > MAX_FILE_SIZE) throw new Error('This image is larger than 10 MB. Choose a smaller photo or scan.');
	const image = await loadImage(file);
	const scale = Math.min(1, MAX_WIDTH / image.naturalWidth, MAX_HEIGHT / image.naturalHeight);
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
	canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
	const context = canvas.getContext('2d');
	if (!context) throw new Error('Your browser could not process this image.');
	context.drawImage(image, 0, 0, canvas.width, canvas.height);

	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Your browser could not process this image.'))), 'image/png');
	});
}
