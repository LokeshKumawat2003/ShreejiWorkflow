import { Box, Button, Flex, HStack, Icon, Text, VisuallyHiddenInput } from '@chakra-ui/react';
import { useRef, useState, type DragEvent } from 'react';
import { FileIcon, UploadIcon } from './icons';

type FileDropzoneProps = {
	accept: string;
	file: File | null;
	onFileSelect: (file: File) => void;
	onClear?: () => void;
	isDisabled?: boolean;
	label: string;
	hint?: string;
	details?: string;
};

function formatSize(bytes: number) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAccepted(file: File, accept: string) {
	const name = file.name.toLowerCase();
	return accept
		.split(',')
		.map((type) => type.trim().toLowerCase())
		.some((type) => (type.startsWith('.') ? name.endsWith(type) : type.endsWith('/*') ? file.type.startsWith(type.slice(0, -1)) : file.type === type));
}

function FileDropzone({ accept, file, onFileSelect, onClear, isDisabled = false, label, hint, details }: FileDropzoneProps) {
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [rejected, setRejected] = useState('');
	const formats = accept.split(',').map((type) => type.trim().replace(/^\./, '').toUpperCase()).join(', ');

	function pick(selected?: File) {
		if (!selected) return;
		if (!isAccepted(selected, accept)) {
			setRejected(`${selected.name} is not a supported file. Use ${formats}.`);
			return;
		}
		setRejected('');
		onFileSelect(selected);
	}

	function openPicker() {
		if (!isDisabled) inputRef.current?.click();
	}

	function handleDrop(event: DragEvent<HTMLDivElement>) {
		event.preventDefault();
		setIsDragging(false);
		if (!isDisabled) pick(event.dataTransfer.files?.[0]);
	}

	return (
		<Box>
			<VisuallyHiddenInput
				ref={inputRef}
				type="file"
				aria-label={label}
				accept={accept}
				disabled={isDisabled}
				onChange={(event) => {
					pick(event.target.files?.[0]);
					event.target.value = '';
				}}
			/>
			{file ? (
				<Flex
					align="center"
					gap={3}
					p={3}
					borderRadius="lg"
					border="1px solid"
					borderColor="brand.100"
					bg="brand.50"
					opacity={isDisabled ? 0.6 : 1}
				>
					<Flex flexShrink={0} align="center" justify="center" w="40px" h="40px" borderRadius="md" bg="white" color="brand.500" border="1px solid" borderColor="brand.100">
						<Icon as={FileIcon} boxSize={5} />
					</Flex>
					<Box flex="1" minW={0}>
						<Text fontSize="sm" fontWeight="600" color="slate.800" noOfLines={1} title={file.name}>{file.name}</Text>
						<Text fontSize="xs" color="slate.500" noOfLines={2}>
							{formatSize(file.size)}
							{details ? ` · ${details}` : ''}
						</Text>
					</Box>
					<HStack spacing={1} flexShrink={0}>
						<Button size="sm" variant="outline" bg="white" isDisabled={isDisabled} onClick={openPicker}>Replace</Button>
						{onClear ? (
							<Button size="sm" variant="ghost" colorScheme="red" isDisabled={isDisabled} onClick={onClear}>Remove</Button>
						) : null}
					</HStack>
				</Flex>
			) : (
				<Flex
					role="button"
					tabIndex={isDisabled ? -1 : 0}
					aria-label={label}
					aria-disabled={isDisabled}
					direction="column"
					align="center"
					justify="center"
					gap={2}
					px={6}
					py={7}
					textAlign="center"
					borderRadius="lg"
					border="2px dashed"
					borderColor={isDragging ? 'brand.500' : 'slate.200'}
					bg={isDragging ? 'brand.50' : 'white'}
					cursor={isDisabled ? 'not-allowed' : 'pointer'}
					opacity={isDisabled ? 0.6 : 1}
					transition="border-color 0.15s, background-color 0.15s"
					_hover={isDisabled ? undefined : { borderColor: 'brand.500', bg: 'slate.50' }}
					_focusVisible={{ outline: 'none', borderColor: 'brand.500', boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.25)' }}
					onClick={openPicker}
					onKeyDown={(event) => {
						if (event.key === 'Enter' || event.key === ' ') {
							event.preventDefault();
							openPicker();
						}
					}}
					onDragOver={(event) => {
						event.preventDefault();
						if (!isDisabled) setIsDragging(true);
					}}
					onDragLeave={() => setIsDragging(false)}
					onDrop={handleDrop}
				>
					<Flex align="center" justify="center" w="48px" h="48px" borderRadius="full" bg="brand.50" color="brand.500">
						<Icon as={UploadIcon} boxSize={6} />
					</Flex>
					<Text fontSize="sm" color="slate.700">
						<Text as="span" fontWeight="700" color="brand.600">Click to upload</Text> or drag and drop
					</Text>
					<Text fontSize="xs" color="slate.500">{hint || formats}</Text>
				</Flex>
			)}
			{rejected ? <Text mt={2} fontSize="xs" color="red.500">{rejected}</Text> : null}
		</Box>
	);
}

export default FileDropzone;
