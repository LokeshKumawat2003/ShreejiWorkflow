import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Heading, HStack, Stack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { ApiError } from '../../services/api';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '../../services/organizationService';
import type { User } from '../../types';
import CreateOrganizationDialog from './components/CreateOrganizationDialog';
import DeleteOrganizationDialog from './components/DeleteOrganizationDialog';
import EditOrganizationDialog from './components/EditOrganizationDialog';
import OrganizationDetailsPage from './components/OrganizationDetailsPage';
import OrganizationStats from './components/OrganizationStats';
import OrganizationTable from './components/OrganizationTable';
import { useOrganizations } from './hooks/useOrganizations';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

function OrganizationsPage() {
  const toast = useToast();
  const organizations = useOrganizations();
  const createDialog = useDisclosure();
  const editDialog = useDisclosure();
  const deleteDialog = useDisclosure();
  const [selectedOrganization, setSelectedOrganization] = useState<User | null>(null);
  const [viewingOrganization, setViewingOrganization] = useState<User | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleCreate(input: CreateOrganizationInput): Promise<boolean> {
    setIsCreating(true);
    try {
      await organizations.create(input);
      createDialog.onClose();
      toast({ title: 'Organization created', status: 'success', position: 'top' });
      return true;
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to create organization.'), status: 'error', position: 'top' });
      return false;
    } finally {
      setIsCreating(false);
    }
  }

  async function handleUpdate(input: UpdateOrganizationInput): Promise<boolean> {
    if (!selectedOrganization?.id) return false;
    setIsUpdating(true);
    try {
      const updatedOrganization = await organizations.update(selectedOrganization.id, input);
      setViewingOrganization((current) => (
        current?.id === updatedOrganization.id ? updatedOrganization : current
      ));
      toast({ title: 'Organization updated', status: 'success', position: 'top' });
      return true;
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to update organization.'), status: 'error', position: 'top' });
      return false;
    } finally {
      setIsUpdating(false);
    }
  }

  async function handleView(organization: User) {
    if (!organization.id) return;
    setViewingOrganization(organization);
    setIsViewing(true);
    try {
      setViewingOrganization(await organizations.getDetails(organization.id));
    } catch (error) {
      setViewingOrganization(null);
      toast({ title: getErrorMessage(error, 'Unable to load organization details.'), status: 'error', position: 'top' });
    } finally {
      setIsViewing(false);
    }
  }

  async function handleDelete() {
    if (!selectedOrganization?.id) return;
    setIsDeleting(true);
    try {
      await organizations.remove(selectedOrganization.id);
      toast({ title: 'Organization deleted', status: 'success', position: 'top' });
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to delete organization.'), status: 'error', position: 'top' });
    } finally {
      setIsDeleting(false);
      setSelectedOrganization(null);
      deleteDialog.onClose();
    }
  }

  function requestDelete(organization: User) {
    setSelectedOrganization(organization);
    deleteDialog.onOpen();
  }

  function requestEdit(organization: User) {
    setSelectedOrganization(organization);
    editDialog.onOpen();
  }

  return (
    <>
      {viewingOrganization ? (
        <OrganizationDetailsPage
          organization={viewingOrganization}
          isLoading={isViewing}
          onBack={() => setViewingOrganization(null)}
          onEdit={() => requestEdit(viewingOrganization)}
        />
      ) : (
        <Stack spacing={6}>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <Box>
              <Heading size="lg" color="slate.900" lineHeight="1.15">Organizations</Heading>
              <Text mt={1} fontSize="sm" color="slate.500">Manage organization accounts and access</Text>
            </Box>
            <Button
              h="40px"
              px={4}
              borderRadius="8px"
              fontSize="sm"
              leftIcon={<AddIcon />}
              colorScheme="brand"
              onClick={createDialog.onOpen}
            >
              Create organization
            </Button>
          </HStack>

          <OrganizationStats {...organizations.stats} />

          <OrganizationTable
            organizations={organizations.organizations}
            page={organizations.page}
            pageSize={organizations.pageSize}
            total={organizations.total}
            totalPages={organizations.totalPages}
            search={organizations.search}
            isLoading={organizations.isLoading}
            loadError={organizations.loadError}
            statusFilter={organizations.statusFilter}
            sortOrder={organizations.sortOrder}
            onSearchChange={organizations.setSearch}
            onStatusChange={organizations.setStatusFilter}
            onSortChange={organizations.setSortOrder}
            onPageChange={organizations.setPage}
            onView={(organization) => void handleView(organization)}
            onEdit={requestEdit}
            onDelete={requestDelete}
          />
        </Stack>
      )}

      <CreateOrganizationDialog
        isOpen={createDialog.isOpen}
        isCreating={isCreating}
        onClose={createDialog.onClose}
        onCreate={handleCreate}
      />
      <EditOrganizationDialog
        isOpen={editDialog.isOpen}
        isSaving={isUpdating}
        organization={selectedOrganization}
        onClose={() => {
          setSelectedOrganization(null);
          editDialog.onClose();
        }}
        onSave={handleUpdate}
      />
      <DeleteOrganizationDialog
        isOpen={deleteDialog.isOpen}
        organization={selectedOrganization}
        isDeleting={isDeleting}
        onClose={() => {
          setSelectedOrganization(null);
          deleteDialog.onClose();
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}

export default OrganizationsPage;