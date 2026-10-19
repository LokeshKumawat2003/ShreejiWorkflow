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

type DeleteEmployeeDialogProps = {
  isOpen: boolean;
  employee: Employee | null;
  isDeleting: boolean;
  action?: 'delete' | 'remove';
  onClose: () => void;
  onConfirm: () => void;
};

function DeleteEmployeeDialog({ isOpen, employee, isDeleting, action = 'delete', onClose, onConfirm }: DeleteEmployeeDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null!);
  const isRemoving = action === 'remove';

  return (
    <AlertDialog isOpen={isOpen} leastDestructiveRef={cancelRef} onClose={onClose}>
      <AlertDialogOverlay>
        <AlertDialogContent>
          <AlertDialogHeader>{isRemoving ? 'Remove employee from organization?' : 'Delete employee?'}</AlertDialogHeader>
          <AlertDialogBody>
            {isRemoving
              ? `${employee?.name} will be removed from your organization. Their employee record and attendance history will be kept.`
              : `This will permanently delete ${employee?.name} and their attendance records.`}
          </AlertDialogBody>
          <AlertDialogFooter>
            <ActionButton ref={cancelRef} tone="neutral" onClick={onClose} isDisabled={isDeleting}>Cancel</ActionButton>
            <ActionButton
              tone="danger"
              onClick={onConfirm}
              isLoading={isDeleting}
              ml={3}
            >
              {isRemoving ? 'Remove' : 'Delete'}
            </ActionButton>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}

export default DeleteEmployeeDialog;