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
import type { User } from '../../../types';

type DeleteOrganizationDialogProps = {
  isOpen: boolean;
  organization: User | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function DeleteOrganizationDialog({
  isOpen,
  organization,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteOrganizationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null!);

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Delete organization?</AlertDialogHeader>
          <AlertDialogBody>
            This will permanently remove {organization?.organizationName} and its login account.
          </AlertDialogBody>
          <AlertDialogFooter>
            <ActionButton ref={cancelRef} tone="neutral" onClick={onClose}>Cancel</ActionButton>
            <ActionButton
              tone="danger"
              onClick={onConfirm}
              isLoading={isDeleting}
              ml={3}
            >
              Delete
            </ActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export default DeleteOrganizationDialog;