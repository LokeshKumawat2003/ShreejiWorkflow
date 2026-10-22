import { Badge, Box, HStack, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { useCallback, useState } from 'react';
import { PageHeader } from '../../components/ui';
import { MASTER_DATA_LABELS } from '../../services/masterDataService';
import type { MasterDataType } from '../../types';
import CompanyProfilePanel from './components/CompanyProfilePanel';
import MasterDataPanel from './components/MasterDataPanel';

const MASTER_DATA_TYPES: MasterDataType[] = ['designation', 'employmentType', 'skillCategory'];

function SettingsPage() {
	const [counts, setCounts] = useState<Partial<Record<MasterDataType, number>>>({});
	const handleCountChange = useCallback((type: MasterDataType, count: number) => {
		setCounts((current) => (current[type] === count ? current : { ...current, [type]: count }));
	}, []);

	return (
		<Stack spacing={6}>
			<PageHeader title="Settings" description="Manage the company profile and the master data used in employee and location forms." />

			<Box>
				<Text mb={3} fontSize="xs" fontWeight="700" color="slate.400" letterSpacing="1.2px">COMPANY</Text>
				<CompanyProfilePanel />
			</Box>

			<Box>
				<Text mb={3} fontSize="xs" fontWeight="700" color="slate.400" letterSpacing="1.2px">MASTER DATA</Text>
				<Tabs colorScheme="brand" variant="soft-rounded" isLazy>
					<TabList gap={2} flexWrap="wrap">
						{MASTER_DATA_TYPES.map((type) => (
							<Tab key={type} fontSize="sm" border="1px solid" borderColor="slate.200" bg="white" _selected={{ bg: 'brand.50', color: 'brand.600', borderColor: 'brand.100' }}>
								<HStack spacing={2}>
									<Text>{MASTER_DATA_LABELS[type].title}</Text>
									{counts[type] !== undefined ? (
										<Badge borderRadius="full" px={2} colorScheme="gray" fontSize="10px">{counts[type]}</Badge>
									) : null}
								</HStack>
							</Tab>
						))}
					</TabList>
					<TabPanels>
						{MASTER_DATA_TYPES.map((type) => (
							<TabPanel key={type} px={0} pt={4}>
								<MasterDataPanel type={type} onCountChange={handleCountChange} />
							</TabPanel>
						))}
					</TabPanels>
				</Tabs>
			</Box>
		</Stack>
	);
}

export default SettingsPage;
