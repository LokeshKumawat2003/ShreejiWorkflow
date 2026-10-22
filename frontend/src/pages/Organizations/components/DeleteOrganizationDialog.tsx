import { ConfirmDialog } from '../../../components/ui';
import type { User } from '../../../types';

type DeleteOrganizationDialogProps = {
  isOpen: boolean;
  organization: User | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

function DeleteOrganizationDialog({ isOpen, organization, isDeleting, onClose, onConfirm }: DeleteOrganizationDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="Delete organization?"
      description={`This will permanently remove ${organization?.organizationName} and its login account.`}
      isLoading={isDeleting}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
}

export default DeleteOrganizationDialog;
