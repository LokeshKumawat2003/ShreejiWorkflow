import { ConfirmDialog } from '../../../components/ui';
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
  const isRemoving = action === 'remove';

  return (
    <ConfirmDialog
      isOpen={isOpen}
      title={isRemoving ? 'Remove employee from organization?' : 'Delete employee?'}
      description={isRemoving
        ? `${employee?.name} will be removed from your organization. Their employee record and attendance history will be kept.`
        : `This will permanently delete ${employee?.name} and their attendance records.`}
      confirmLabel={isRemoving ? 'Remove' : 'Delete'}
      isLoading={isDeleting}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

export default DeleteEmployeeDialog;
