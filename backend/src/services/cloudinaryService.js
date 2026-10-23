const { v2: cloudinary } = require('cloudinary');
const { httpError } = require('../utils/httpError');

const SIGNATURE_FOLDER = 'shreeji-workflow/signatures';

function cloudName() {
	if (process.env.CLOUDINARY_CLOUD_NAME) return process.env.CLOUDINARY_CLOUD_NAME;
	const match = /@([^/?]+)/.exec(process.env.CLOUDINARY_URL || '');
	return match ? match[1] : '';
}

function isCloudinaryConfigured() {
	return Boolean(process.env.CLOUDINARY_URL || (
		process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
	));
}

function configure() {
	if (!isCloudinaryConfigured()) {
		throw httpError(503, 'Image uploads are not configured. Add the Cloudinary keys to the backend .env file.');
	}
	if (process.env.CLOUDINARY_CLOUD_NAME) {
		cloudinary.config({
			cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
			api_key: process.env.CLOUDINARY_API_KEY,
			api_secret: process.env.CLOUDINARY_API_SECRET,
			secure: true,
		});
	} else {
		cloudinary.config({ secure: true });
	}
}

/** True for https URLs of images stored in this account's signature folder. */
function isSignatureUrl(value) {
	const name = cloudName();
	if (!name) return false;
	const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(`^https://res\\.cloudinary\\.com/${escaped}/image/upload/(v\\d+/)?${SIGNATURE_FOLDER}/[\\w-]+\\.(png|jpe?g)$`).test(value);
}

function publicIdFromUrl(url) {
	const match = /\/image\/upload\/(?:v\d+\/)?(.+)\.(?:png|jpe?g)$/.exec(url || '');
	return match ? match[1] : null;
}

function uploadSignatureImage(buffer) {
	configure();
	return new Promise((resolve, reject) => {
		const stream = cloudinary.uploader.upload_stream(
			{ folder: SIGNATURE_FOLDER, resource_type: 'image', allowed_formats: ['png', 'jpg', 'jpeg'], overwrite: false },
			(error, result) => {
				if (error || !result) return reject(httpError(502, 'The signature could not be uploaded to Cloudinary. Try again.'));
				return resolve({ url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height });
			},
		);
		stream.end(buffer);
	});
}

async function deleteSignatureImage(url) {
	const publicId = publicIdFromUrl(url);
	if (!publicId || !publicId.startsWith(`${SIGNATURE_FOLDER}/`) || !isCloudinaryConfigured()) return;
	try {
		configure();
		await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
	} catch (error) {
		console.warn('Unable to delete old signature from Cloudinary:', error.message || error);
	}
}

module.exports = { SIGNATURE_FOLDER, deleteSignatureImage, isCloudinaryConfigured, isSignatureUrl, uploadSignatureImage };
