import {
	AlertDialog,
	AlertDialogBody,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
} from '@chakra-ui/react';
import { useRef, type ReactNode } from 'react';
import ActionButton from './ActionButton';

type ConfirmDialogProps = {
	isOpen: boolean;
	title: ReactNode;
	description: ReactNode;
	confirmLabel?: string;
	tone?: 'danger' | 'primary';
	isLoading?: boolean;
	onClose: () => void;
	onConfirm: () => void;
};

function ConfirmDialog({
	isOpen,
	title,
	description,
	confirmLabel = 'Delete',
	tone = 'danger',
	isLoading = false,
	onClose,
	onConfirm,
}: ConfirmDialogProps) {
	const cancelRef = useRef<HTMLButtonElement>(null!);

	return (
		<AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose} isCentered>
			<AlertDialogOverlay bg="blackAlpha.600" backdropFilter="blur(3px)">
				<AlertDialogContent borderRadius="lg">
					<AlertDialogHeader color="slate.900">{title}</AlertDialogHeader>
					<AlertDialogBody fontSize="sm" color="slate.500">{description}</AlertDialogBody>
					<AlertDialogFooter gap={3}>
						<ActionButton ref={cancelRef} tone="neutral" onClick={onClose} isDisabled={isLoading}>Cancel</ActionButton>
						<ActionButton tone={tone} onClick={onConfirm} isLoading={isLoading}>{confirmLabel}</ActionButton>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialogOverlay>
		</AlertDialog>
	);
}

export default ConfirmDialog;
