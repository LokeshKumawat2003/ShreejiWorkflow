import {
	AlertDialog,
	AlertDialogBody,
	AlertDialogContent,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogOverlay,
} from '@chakra-ui/react';
import { useRef } from 'react';
import ActionButton from '../../../components/common/ActionButton';
import type { OrganizationLocation } from '../../../types';

type DeleteLocationDialogProps = {
	isOpen: boolean;
	location: OrganizationLocation | null;
	isDeleting: boolean;
	onClose: () => void;
	onConfirm: () => void;
};

function DeleteLocationDialog({ isOpen, location, isDeleting, onClose, onConfirm }: DeleteLocationDialogProps) {
	const cancelRef = useRef<HTMLButtonElement>(null!);

	return (
		<AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
			<AlertDialogOverlay>
				<AlertDialogContent>
					<AlertDialogHeader>Delete location?</AlertDialogHeader>
					<AlertDialogBody>
						This will delete {location?.name}. Employee records and attendance will remain, but employees will no longer be assigned to this location.
					</AlertDialogBody>
					<AlertDialogFooter>
						<ActionButton ref={cancelRef} tone="neutral" onClick={onClose}>Cancel</ActionButton>
						<ActionButton tone="danger" onClick={onConfirm} isLoading={isDeleting} ml={3}>Delete</ActionButton>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialogOverlay>
		</AlertDialog>
	);
}

export default DeleteLocationDialog;