import { Badge, Box, HStack, Stack, Tab, TabList, TabPanel, TabPanels, Tabs, Text } from '@chakra-ui/react';
import { useCallback, useState, type ReactNode } from 'react';
import { PageHeader } from '../../components/ui';
import { MASTER_DATA_LABELS } from '../../services/masterDataService';
import type { MasterDataType } from '../../types';
import AppointmentLetterSettingsPanel from './components/AppointmentLetterSettingsPanel';
import MasterDataPanel from './components/MasterDataPanel';
import SalarySlipSettingsPanel from './components/SalarySlipSettingsPanel';

const MASTER_DATA_TYPES: MasterDataType[] = ['designation', 'employmentType', 'skillCategory'];

const pillTab = {
	h: '40px',
	px: 4,
	gap: 2,
	flexShrink: 0,
	borderRadius: 'full',
	fontSize: 'sm',
	fontWeight: '600',
	color: 'slate.600',
	whiteSpace: 'nowrap',
	transition: 'all 0.15s ease',
	_hover: { bg: 'white', color: 'slate.900' },
	_selected: { bg: 'white', color: 'brand.600', boxShadow: 'sm', border: '1px solid', borderColor: 'slate.200' },
} as const;

function SectionTab({ icon, children }: { icon: ReactNode; children: ReactNode }) {
	return (
		<Tab {...pillTab}>
			<Box as="span" display="grid" placeItems="center" w="22px" h="22px" borderRadius="7px" bg="brand.50" color="brand.600" fontSize="xs" fontWeight="800">
				{icon}
			</Box>
			{children}
		</Tab>
	);
}

function SettingsPage() {
	const [counts, setCounts] = useState<Partial<Record<MasterDataType, number>>>({});
	const handleCountChange = useCallback((type: MasterDataType, count: number) => {
		setCounts((current) => (current[type] === count ? current : { ...current, [type]: count }));
	}, []);

	return (
		<Stack spacing={6}>
			<PageHeader title="Settings" description="Salary slip and appointment letter are set up separately. Master data feeds employee and location forms." />

			<Tabs variant="unstyled" isLazy>
				<Box p={1.5} bg="slate.100" borderRadius="full" display="inline-flex" maxW="100%" overflowX="auto" sx={{ scrollbarWidth: 'none' }}>
					<TabList gap={1}>
						<SectionTab icon="₹">Salary slip</SectionTab>
						<SectionTab icon="✉">Appointment letter</SectionTab>
						<SectionTab icon="≡">Master data</SectionTab>
					</TabList>
				</Box>

				<TabPanels>
					<TabPanel px={0} pt={5}>
						<SalarySlipSettingsPanel />
					</TabPanel>
					<TabPanel px={0} pt={5}>
						<AppointmentLetterSettingsPanel />
					</TabPanel>
					<TabPanel px={0} pt={5}>
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
					</TabPanel>
				</TabPanels>
			</Tabs>
		</Stack>
	);
}

export default SettingsPage;
