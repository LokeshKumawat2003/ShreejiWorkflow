import { ConfirmDialog } from '../../../components/ui';
import type { OrganizationLocation } from '../../../types';

type DeleteLocationDialogProps = {
	isOpen: boolean;
	location: OrganizationLocation | null;
	isDeleting: boolean;
	onClose: () => void;
	onConfirm: () => void;
};

function DeleteLocationDialog({ isOpen, location, isDeleting, onClose, onConfirm }: DeleteLocationDialogProps) {
	return (
		<ConfirmDialog
			isOpen={isOpen}
			title="Delete location?"
			description={`This will delete ${location?.name}. Employee records and attendance will remain, but employees will no longer be assigned to this location.`}
			isLoading={isDeleting}
			onClose={onClose}
			onConfirm={onConfirm}
		/>
	);
}

export default DeleteLocationDialog;
