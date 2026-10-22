import type { CreateOrganizationInput } from '../../../services/organizationService';
import OrganizationFormDialog from './OrganizationFormDialog';

type CreateOrganizationDialogProps = {
  isOpen: boolean;
  isCreating: boolean;
  onClose: () => void;
  onCreate: (input: CreateOrganizationInput) => Promise<boolean>;
};

function CreateOrganizationDialog({ isOpen, isCreating, onClose, onCreate }: CreateOrganizationDialogProps) {
  return (
    <OrganizationFormDialog
      isOpen={isOpen}
      isSaving={isCreating}
      organization={null}
      onClose={onClose}
      onSubmit={onCreate}
    />
  );
}

export default CreateOrganizationDialog;
