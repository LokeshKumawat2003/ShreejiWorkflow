import { DownloadIcon } from '@chakra-ui/icons';
import {
	Box,
	Flex,
	HStack,
	Modal,
	ModalBody,
	ModalCloseButton,
	ModalContent,
	ModalFooter,
	ModalHeader,
	ModalOverlay,
	Spinner,
	Text,
} from '@chakra-ui/react';
import { ActionButton, PrintIcon } from '../../../components/ui';
import type { PdfAction } from '../../../utils/pdfOutput';

type AppointmentLetterPreviewDialogProps = {
	isOpen: boolean;
	employeeName: string;
	url: string | null;
	onClose: () => void;
	onAction: (action: PdfAction) => void;
};

function AppointmentLetterPreviewDialog({ isOpen, employeeName, url, onClose, onAction }: AppointmentLetterPreviewDialogProps) {
	return (
		<Modal isOpen={isOpen} onClose={onClose} size="5xl" isCentered scrollBehavior="inside">
			<ModalOverlay />
			<ModalContent h={{ base: '100vh', md: '90vh' }} my={{ base: 0, md: 'auto' }}>
				<ModalHeader pr={12}>
					<Text fontSize="lg" fontWeight="700" color="slate.900">Appointment letter</Text>
					<Text fontSize="sm" fontWeight="500" color="slate.500" noOfLines={1}>{employeeName}</Text>
				</ModalHeader>
				<ModalCloseButton />
				<ModalBody p={0} bg="slate.100" display="flex">
					{url ? (
						<Box as="iframe" src={`${url}#toolbar=0&navpanes=0`} title={`Appointment letter for ${employeeName}`} flex="1" w="100%" border="0" />
					) : (
						<Flex flex="1" align="center" justify="center" direction="column" gap={3}>
							<Spinner color="brand.500" />
							<Text fontSize="sm" color="slate.500">Preparing the letter…</Text>
						</Flex>
					)}
				</ModalBody>
				<ModalFooter>
					<HStack spacing={2}>
						<ActionButton tone="neutral" onClick={onClose}>Close</ActionButton>
						<ActionButton tone="neutral" leftIcon={<PrintIcon boxSize={4} />} isDisabled={!url} onClick={() => onAction('print')}>Print</ActionButton>
						<ActionButton leftIcon={<DownloadIcon />} isDisabled={!url} onClick={() => onAction('download')}>Download</ActionButton>
					</HStack>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export default AppointmentLetterPreviewDialog;
