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
import type { Employee } from '../../../types';

type RemoveOrganizationEmployeeDialogProps = {
  isOpen: boolean;
  employee: Employee | null;
  organizationName: string;
  isRemoving: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function RemoveOrganizationEmployeeDialog({
  isOpen,
  employee,
  organizationName,
  isRemoving,
  onClose,
  onConfirm,
}: RemoveOrganizationEmployeeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null!);

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>Remove employee from organization?</AlertDialogHeader>
          <AlertDialogBody>
            {employee?.name} will be removed from {organizationName}. Their employee record and attendance history will be kept.
          </AlertDialogBody>
          <AlertDialogFooter>
            <ActionButton ref={cancelRef} tone="neutral" onClick={onClose} isDisabled={isRemoving}>Cancel</ActionButton>
            <ActionButton
              tone="danger"
              onClick={onConfirm}
              isLoading={isRemoving}
              ml={3}
            >
              Remove
            </ActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export default RemoveOrganizationEmployeeDialog;