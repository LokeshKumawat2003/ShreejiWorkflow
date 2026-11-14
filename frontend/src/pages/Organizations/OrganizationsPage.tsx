import { AddIcon } from '@chakra-ui/icons';
import { Box, Button, Flex, Heading, HStack, Stack, Text, useDisclosure, useToast } from '@chakra-ui/react';
import { useState } from 'react';
import { BuildingIcon } from '../../components/ui';
import { ApiError } from '../../services/api';
import type { CreateOrganizationInput, UpdateOrganizationInput } from '../../services/organizationService';
import type { OrganizationLocation, User } from '../../types';
import type { CreateLocationInput } from '../../services/locationService';
import { useLocations } from './hooks/useLocations';
import CreateOrganizationDialog from './components/CreateOrganizationDialog';
import CreateLocationDialog from './components/CreateLocationDialog';
import DeleteLocationDialog from './components/DeleteLocationDialog';
import DeleteOrganizationDialog from './components/DeleteOrganizationDialog';
import EditOrganizationDialog from './components/EditOrganizationDialog';
import OrganizationDetailsPage from './components/OrganizationDetailsPage';
import OrganizationStats from './components/OrganizationStats';
import OrganizationTable from './components/OrganizationTable';
import LocationWorkspacePage from './components/LocationWorkspacePage';
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
  const locationDialog = useDisclosure();
  const deleteLocationDialog = useDisclosure();
  const [selectedOrganization, setSelectedOrganization] = useState<User | null>(null);
  const [viewingOrganization, setViewingOrganization] = useState<User | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<OrganizationLocation | null>(null);
  const [editingLocation, setEditingLocation] = useState<OrganizationLocation | null>(null);
  const [deletingLocation, setDeletingLocation] = useState<OrganizationLocation | null>(null);
  const locationOrganizationId = viewingOrganization?.id || viewingOrganization?._id;
  const locations = useLocations(locationOrganizationId);
  const [isCreating, setIsCreating] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [isDeletingLocation, setIsDeletingLocation] = useState(false);
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
    setSelectedLocation(null);
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

  async function handleSaveLocation(input: CreateLocationInput): Promise<boolean> {
    const organizationId = viewingOrganization?.id || viewingOrganization?._id;
    if (!organizationId) return false;
    setIsSavingLocation(true);
    try {
      if (editingLocation) {
        await locations.update(editingLocation.id, input);
        setSelectedLocation((current) => current?.id === editingLocation.id ? { ...current, ...input } : current);
        toast({ title: 'Location updated', status: 'success', position: 'top' });
      } else {
        await locations.create(input);
        toast({ title: 'Location added', status: 'success', position: 'top' });
      }
      return true;
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to save location.'), status: 'error', position: 'top' });
      return false;
    } finally {
      setIsSavingLocation(false);
    }
  }

  async function handleDeleteLocation() {
    if (!deletingLocation) return;
    setIsDeletingLocation(true);
    try {
      await locations.remove(deletingLocation.id);
      toast({ title: 'Location deleted', status: 'success', position: 'top' });
    } catch (error) {
      toast({ title: getErrorMessage(error, 'Unable to delete location.'), status: 'error', position: 'top' });
    } finally {
      setIsDeletingLocation(false);
      setDeletingLocation(null);
      deleteLocationDialog.onClose();
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
      {viewingOrganization ? selectedLocation ? (
        <LocationWorkspacePage
          organization={viewingOrganization}
          location={selectedLocation}
          onBack={() => setSelectedLocation(null)}
        />
      ) : (
        <OrganizationDetailsPage
          organization={viewingOrganization}
          isLoading={isViewing}
          onBack={() => setViewingOrganization(null)}
          onEdit={() => requestEdit(viewingOrganization)}
          locationList={locations}
          onAddLocation={locationDialog.onOpen}
          onViewLocation={setSelectedLocation}
          onEditLocation={(location) => {
            setEditingLocation(location);
            locationDialog.onOpen();
          }}
          onDeleteLocation={(location) => {
            setDeletingLocation(location);
            deleteLocationDialog.onOpen();
          }}
        />
      ) : (
        <Stack spacing={6}>
          <HStack justify="space-between" align="center" flexWrap="wrap" gap={4}>
            <HStack spacing={4}>
              <Flex
                boxSize={{ base: '48px', md: '56px' }}
                flexShrink={0}
                align="center"
                justify="center"
                borderRadius="16px"
                bgGradient="linear(135deg, brand.400, brand.600)"
                color="white"
                boxShadow="0 8px 20px rgba(79, 70, 229, 0.28)"
              >
                <BuildingIcon boxSize={6} />
              </Flex>
              <Box>
                <Heading fontSize={{ base: '24px', md: '30px' }} fontWeight="800" color="slate.900" lineHeight="1.15" letterSpacing="-0.02em">Organizations</Heading>
                <Text mt={1} fontSize="sm" color="slate.500">Manage organization accounts and access</Text>
              </Box>
            </HStack>
            <Button
              h="44px"
              px={5}
              fontSize="sm"
              fontWeight="600"
              color="white"
              bgGradient="linear(to-r, brand.500, brand.600)"
              boxShadow="0 6px 16px rgba(79, 70, 229, 0.3)"
              leftIcon={<AddIcon boxSize={3} />}
              iconSpacing={2.5}
              _hover={{ bgGradient: 'linear(to-r, brand.600, brand.700)' }}
              _active={{ bgGradient: 'linear(to-r, brand.600, brand.700)' }}
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
      <CreateLocationDialog
        isOpen={locationDialog.isOpen}
        isSaving={isSavingLocation}
        location={editingLocation}
        onClose={() => {
          setEditingLocation(null);
          locationDialog.onClose();
        }}
        onSave={handleSaveLocation}
      />
      <DeleteLocationDialog
        isOpen={deleteLocationDialog.isOpen}
        location={deletingLocation}
        isDeleting={isDeletingLocation}
        onClose={() => {
          setDeletingLocation(null);
          deleteLocationDialog.onClose();
        }}
        onConfirm={() => void handleDeleteLocation()}
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