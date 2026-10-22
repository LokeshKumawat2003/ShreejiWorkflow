import type { UpdateOrganizationInput } from '../../../services/organizationService';
import type { User } from '../../../types';
import OrganizationFormDialog from './OrganizationFormDialog';

type EditOrganizationDialogProps = {
  isOpen: boolean;
  isSaving: boolean;
  organization: User | null;
  onClose: () => void;
  onSave: (input: UpdateOrganizationInput) => Promise<boolean>;
};

function EditOrganizationDialog({ isOpen, isSaving, organization, onClose, onSave }: EditOrganizationDialogProps) {
  return (
    <OrganizationFormDialog
      isOpen={isOpen && organization !== null}
      isSaving={isSaving}
      organization={organization}
      onClose={onClose}
      onSubmit={async ({ password: _password, ...input }) => {
        const saved = await onSave(input);
        if (saved) onClose();
        return saved;
      }}
    />
  );
}

export default EditOrganizationDialog;
