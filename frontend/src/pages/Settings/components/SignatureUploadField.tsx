import { Button, Flex, FormControl, FormHelperText, FormLabel, HStack, Image, Text } from '@chakra-ui/react';
import { useRef, useState, type ChangeEvent } from 'react';
import { ApiError } from '../../../services/api';
import { uploadSignatureImage } from '../../../services/settingsService';
import { prepareSignatureImage } from '../utils/signatureImage';

type SignatureUploadFieldProps = {
	value: string;
	onChange: (url: string) => void;
};

function SignatureUploadField({ value, onChange }: SignatureUploadFieldProps) {
	const fileInput = useRef<HTMLInputElement>(null);
	const [error, setError] = useState('');
	const [isUploading, setIsUploading] = useState(false);

	async function handleFile(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';
		if (!file) return;
		setError('');
		setIsUploading(true);
		try {
			const image = await uploadSignatureImage(await prepareSignatureImage(file), 'signature.png');
			onChange(image.url);
		} catch (uploadError) {
			setError(uploadError instanceof ApiError || uploadError instanceof Error ? uploadError.message : 'Unable to upload this image.');
		} finally {
			setIsUploading(false);
		}
	}

	return (
		<FormControl isInvalid={Boolean(error)}>
			<FormLabel fontSize="sm" fontWeight="600" color="slate.700">E-sign image</FormLabel>
			<Flex align="center" gap={4} wrap="wrap">
				<Flex align="center" justify="center" w="180px" h="72px" borderWidth="1px" borderStyle="dashed" borderColor="slate.300" borderRadius="lg" bg="white" overflow="hidden">
					{value
						? <Image src={value} alt="Signature" maxH="64px" maxW="170px" objectFit="contain" />
						: <Text fontSize="xs" color="slate.400">No signature</Text>}
				</Flex>
				<HStack spacing={2}>
					<Button size="sm" variant="outline" isLoading={isUploading} loadingText="Uploading" onClick={() => fileInput.current?.click()}>
						{value ? 'Replace' : 'Upload'}
					</Button>
					{value && !isUploading ? (
						<Button size="sm" variant="ghost" colorScheme="red" onClick={() => onChange('')}>Remove</Button>
					) : null}
				</HStack>
			</Flex>
			<input ref={fileInput} type="file" accept="image/png,image/jpeg" hidden onChange={(event) => void handleFile(event)} />
			{error
				? <Text mt={2} fontSize="sm" color="red.500">{error}</Text>
				: <FormHelperText>Uploaded to Cloudinary, then click Save. PNG with a transparent or white background works best. Leave empty to sign by hand after printing.</FormHelperText>}
		</FormControl>
	);
}

export default SignatureUploadField;
