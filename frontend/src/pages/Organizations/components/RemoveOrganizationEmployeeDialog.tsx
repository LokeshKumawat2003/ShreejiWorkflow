import { ConfirmDialog } from '../../../components/ui';
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
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Remove employee from organization?"
      description={`${employee?.name} will be removed from ${organizationName}. Their employee record and attendance history will be kept.`}
      confirmLabel="Remove"
      isLoading={isRemoving}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

export default RemoveOrganizationEmployeeDialog;
