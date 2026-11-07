import { Alert, Skeleton, Stack } from '@chakra-ui/react';
import { EmptyState, FilterBar, FilterField, FilterSelect, MapPinIcon } from '../../../components/ui';
import { locationLabel, useOwnLocations } from '../hooks/useOwnLocations';
import AttendanceRegisterGrid from './AttendanceRegisterGrid';

type OrganizationRegisterPageProps = {
	organizationId: string;
};

function OrganizationRegisterPage({ organizationId }: OrganizationRegisterPageProps) {
	const { locations, locationId, setLocationId, error } = useOwnLocations(organizationId);

	if (!locations) return <Skeleton h="320px" borderRadius="lg" />;
	if (error) return <Alert status="error" borderRadius="md">{error}</Alert>;
	if (locations.length === 0) {
		return (
			<EmptyState
				icon={<MapPinIcon boxSize={6} />}
				title="No locations yet"
				description="The Register of Attendance is kept per location. Ask your administrator to add your sites."
			/>
		);
	}

	return (
		<Stack spacing={4}>
			<FilterBar>
				<FilterField label="Location" flex={{ base: '1 1 100%', md: '0 1 420px' }}>
					<FilterSelect
						label="Select location"
						value={locationId}
						onChange={setLocationId}
						options={locations.map((location) => ({ value: location.id, label: locationLabel(location) }))}
					/>
				</FilterField>
			</FilterBar>
			{locationId ? <AttendanceRegisterGrid key={locationId} organizationId={organizationId} locationId={locationId} readOnly /> : null}
		</Stack>
	);
}

export default OrganizationRegisterPage;
