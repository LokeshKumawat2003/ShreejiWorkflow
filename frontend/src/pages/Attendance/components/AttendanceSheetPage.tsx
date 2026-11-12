import { ChevronDownIcon, DeleteIcon, DownloadIcon, InfoOutlineIcon } from '@chakra-ui/icons';
import {
	Alert,
	AlertDescription,
	AlertIcon,
	Box,
	Button,
	Flex,
	Heading,
	HStack,
	Menu,
	MenuButton,
	MenuDivider,
	MenuItem,
	MenuList,
	Skeleton,
	Stack,
	Text,
	Tooltip,
	useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionButton, ConfirmDialog, EmptyState, FilterBar, FilterField, FilterInput, FilterSelect, MapPinIcon, PrintIcon } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import {
	clearAttendanceSheetDraft,
	getAttendanceRegister,
	getAttendanceSheetDraft,
	saveAttendanceSheetDraft,
	type AttendanceRegister,
	type AttendanceRegisterMark,
	type AttendanceSheetScope,
} from '../../../services/attendanceService';
import { locationLabel, useOwnLocations } from '../hooks/useOwnLocations';
import { REGISTER_MARK_META, presentTotal } from '../utils/attendanceStatus';
import { exportRegisterExcel, exportRegisterPdf } from '../utils/attendanceRegisterExport';

type AttendanceSheetPageProps = {
	organizationId: string;
};

type SheetMarks = Record<string, AttendanceRegisterMark[]>;
type ExportFormat = 'pdf' | 'excel' | 'print';
type SaveState = 'idle' | 'pending' | 'saving' | 'saved' | 'error';
type PendingSave = { scope: AttendanceSheetScope; marks: SheetMarks; legacyKey?: string };

const SAVE_DELAY_MS = 700;
const SAVE_LABEL: Record<SaveState, string> = {
	idle: '',
	pending: 'Unsaved changes…',
	saving: 'Saving…',
	saved: 'All changes saved',
	error: 'Could not save — changes will retry on your next edit',
};

const BRUSHES: AttendanceRegisterMark[] = ['P', 'A', 'HD', 'L', 'CL', 'SL', 'PL', 'WO', 'H', ''];
const FILE_PREFIX = 'attendance-sheet';
const CELL_SIZE = '30px';
const NAME_WIDTH = 220;
const WEEKDAY = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function currentMonth() {
	const date = new Date();
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function weekdayOf(month: string, day: number) {
	const [year, monthNumber] = month.split('-').map(Number);
	return new Date(year, monthNumber - 1, day).getDay();
}

function legacyDraftKey(scope: AttendanceSheetScope) {
	return `attendance-sheet:${scope.organizationId}:${scope.locationId}:${scope.month}`;
}

function readLegacyDraft(key: string): SheetMarks {
	try {
		const value = JSON.parse(localStorage.getItem(key) || '{}') as unknown;
		return value && typeof value === 'object' ? value as SheetMarks : {};
	} catch {
		return {};
	}
}

function hasMarks(marks: SheetMarks) {
	return Object.values(marks).some((days) => Array.isArray(days) && days.some(Boolean));
}

function brushLabel(mark: AttendanceRegisterMark) {
	return mark ? `${mark} · ${REGISTER_MARK_META[mark].label}` : 'Eraser (blank)';
}

function AttendanceSheetPage({ organizationId }: AttendanceSheetPageProps) {
	const toast = useToast();
	const { locations, locationId, setLocationId, error: locationError } = useOwnLocations(organizationId);
	const [month, setMonth] = useState(currentMonth);
	const [template, setTemplate] = useState<AttendanceRegister | null>(null);
	const [marks, setMarks] = useState<SheetMarks>({});
	const [isLoading, setIsLoading] = useState(false);
	const [loadError, setLoadError] = useState('');
	const [brush, setBrush] = useState<AttendanceRegisterMark>('P');
	const [exporting, setExporting] = useState<ExportFormat | null>(null);
	const [isClearOpen, setIsClearOpen] = useState(false);
	const [isClearing, setIsClearing] = useState(false);
	const [saveState, setSaveState] = useState<SaveState>('idle');
	const saveTimer = useRef<number | undefined>(undefined);
	const pendingSave = useRef<PendingSave | null>(null);

	const scope = useMemo<AttendanceSheetScope | null>(
		() => (locationId ? { organizationId, locationId, month } : null),
		[locationId, month, organizationId],
	);

	const flushSave = useCallback(() => {
		window.clearTimeout(saveTimer.current);
		const job = pendingSave.current;
		pendingSave.current = null;
		if (!job) return;
		setSaveState('saving');
		saveAttendanceSheetDraft(job.scope, job.marks)
			.then(() => {
				if (job.legacyKey) localStorage.removeItem(job.legacyKey);
				setSaveState(pendingSave.current ? 'pending' : 'saved');
			})
			.catch(() => {
				if (!pendingSave.current) pendingSave.current = job;
				setSaveState('error');
			});
	}, []);

	const scheduleSave = useCallback((job: PendingSave) => {
		pendingSave.current = job;
		setSaveState('pending');
		window.clearTimeout(saveTimer.current);
		saveTimer.current = window.setTimeout(flushSave, SAVE_DELAY_MS);
	}, [flushSave]);

	useEffect(() => {
		if (!scope) return;
		const controller = new AbortController();
		setIsLoading(true);
		setLoadError('');
		setSaveState('idle');
		Promise.all([
			getAttendanceRegister(scope, controller.signal),
			getAttendanceSheetDraft(scope, controller.signal),
		])
			.then(([register, draft]) => {
				const rows = register.rows.filter((row) => row.employeeStatus !== 'disabled');
				const legacyKey = legacyDraftKey(scope);
				const legacy = hasMarks(draft.marks) ? {} : readLegacyDraft(legacyKey);
				const source = hasMarks(legacy) ? legacy : draft.marks;
				const nextMarks = Object.fromEntries(rows.map((row) => {
					const saved = source[row.employeeId];
					return [row.employeeId, Array.from({ length: register.daysInMonth }, (_, index) => saved?.[index] ?? '')];
				}));
				setTemplate({ ...register, rows });
				setMarks(nextMarks);
				if (hasMarks(legacy)) scheduleSave({ scope, marks: nextMarks, legacyKey });
				else if (draft.updatedAt) setSaveState('saved');
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setTemplate(null);
				setLoadError(error instanceof ApiError ? error.message : 'Unable to load employees for this location.');
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => {
			controller.abort();
			flushSave();
		};
	}, [scope, scheduleSave, flushSave]);

	function updateMarks(updater: (current: SheetMarks) => SheetMarks) {
		const next = updater(marks);
		setMarks(next);
		if (scope) scheduleSave({ scope, marks: next });
	}

	const days = useMemo(() => Array.from({ length: template?.daysInMonth ?? 0 }, (_, index) => index + 1), [template]);
	const sundays = useMemo(() => new Set(days.filter((day) => weekdayOf(month, day) === 0).map((day) => day - 1)), [days, month]);
	const rows = template?.rows ?? [];
	const filledCells = rows.reduce((sum, row) => sum + (marks[row.employeeId] || []).filter(Boolean).length, 0);
	const totalMandays = rows.reduce((sum, row) => sum + presentTotal(marks[row.employeeId] || []), 0);

	function setCell(employeeId: string, dayIndex: number) {
		if (sundays.has(dayIndex)) return;
		updateMarks((current) => {
			const rowMarks = [...(current[employeeId] || [])];
			rowMarks[dayIndex] = rowMarks[dayIndex] === brush ? '' : brush;
			return { ...current, [employeeId]: rowMarks };
		});
	}

	function fillDay(dayIndex: number) {
		if (sundays.has(dayIndex)) return;
		updateMarks((current) => Object.fromEntries(Object.entries(current).map(([employeeId, rowMarks]) => {
			const next = [...rowMarks];
			next[dayIndex] = brush;
			return [employeeId, next];
		})));
	}

	function fillRow(employeeId: string) {
		updateMarks((current) => ({
			...current,
			[employeeId]: (current[employeeId] || []).map((_, index) => (sundays.has(index) ? '' : brush)),
		}));
	}

	function fillAll(onlyBlanks: boolean) {
		updateMarks((current) => Object.fromEntries(Object.entries(current).map(([employeeId, rowMarks]) => [
			employeeId,
			rowMarks.map((mark, index) => (sundays.has(index) || (onlyBlanks && mark) ? mark : brush)),
		])));
	}

	async function clearAll() {
		if (!scope) return;
		window.clearTimeout(saveTimer.current);
		pendingSave.current = null;
		setIsClearing(true);
		try {
			await clearAttendanceSheetDraft(scope);
			localStorage.removeItem(legacyDraftKey(scope));
			setMarks((current) => Object.fromEntries(Object.keys(current).map((employeeId) => [employeeId, current[employeeId].map(() => '' as AttendanceRegisterMark)])));
			setSaveState('idle');
			setIsClearOpen(false);
		} catch (error) {
			toast({ title: error instanceof ApiError ? error.message : 'Unable to clear the sheet.', status: 'error', position: 'top' });
		} finally {
			setIsClearing(false);
		}
	}

	async function exportSheet(format: ExportFormat) {
		if (!template) return;
		const sheetRows = template.rows.map((row, index) => {
			const rowMarks = marks[row.employeeId] || [];
			return { ...row, serial: index + 1, days: rowMarks, totalPresent: presentTotal(rowMarks) };
		});
		const sheet: AttendanceRegister = { ...template, rows: sheetRows, totalMandays };
		setExporting(format);
		try {
			const options = { filePrefix: FILE_PREFIX, plain: true };
			if (format === 'excel') await exportRegisterExcel(sheet, options);
			else await exportRegisterPdf(sheet, format === 'print' ? 'print' : 'download', options);
		} catch {
			toast({ title: 'Unable to create the file.', status: 'error', position: 'top' });
		} finally {
			setExporting(null);
		}
	}

	if (!locations) return <Skeleton h="320px" borderRadius="lg" />;
	if (locationError) return <Alert status="error" borderRadius="md">{locationError}</Alert>;
	if (locations.length === 0) {
		return (
			<EmptyState
				icon={<MapPinIcon boxSize={6} />}
				title="No locations yet"
				description="Attendance sheets are made per location. Ask your administrator to add your sites."
			/>
		);
	}

	return (
		<Stack spacing={5}>
			<Box>
				<Heading size="lg" color="slate.900" lineHeight="1.15">Attendance sheet</Heading>
				<Text mt={1} fontSize="sm" color="slate.500">
					Fill the month's attendance and download it as PDF or Excel to send to the admin.
				</Text>
			</Box>

			<Alert status="info" borderRadius="md" fontSize="sm">
				<AlertIcon />
				<AlertDescription>
					This sheet does not mark attendance in the system. Your entries are saved automatically as a draft, so you can continue later from any device.
				</AlertDescription>
			</Alert>

			<FilterBar>
				<FilterField label="Location" flex={{ base: '1 1 100%', md: '1 1 320px' }} maxW={{ md: '420px' }}>
					<FilterSelect
						label="Select location"
						value={locationId}
						onChange={setLocationId}
						options={locations.map((location) => ({ value: location.id, label: locationLabel(location) }))}
					/>
				</FilterField>
				<FilterField label="Month" flex={{ base: '1 1 100%', md: '0 0 170px' }}>
					<FilterInput
						aria-label="Sheet month"
						type="month"
						value={month}
						onChange={(event) => {
							if (event.target.value) setMonth(event.target.value);
						}}
					/>
				</FilterField>
			</FilterBar>

			<Box bg="white" border="1px solid" borderColor="slate.200" borderRadius="lg" boxShadow="sm" overflow="hidden">
				<Flex
					px={{ base: 3, md: 4 }}
					py={3}
					gap={3}
					justify="space-between"
					align={{ base: 'stretch', lg: 'center' }}
					direction={{ base: 'column', lg: 'row' }}
					borderBottom="1px solid"
					borderColor="slate.100"
				>
					<Box>
						<Text fontWeight="700" color="slate.900">{template?.periodLabel || 'Attendance sheet'}</Text>
						<Text fontSize="xs" color="slate.500">
							{rows.length} employees · {filledCells} cells filled · Total mandays {totalMandays}
						</Text>
						{saveState !== 'idle' && (
							<Text fontSize="xs" mt={0.5} color={saveState === 'error' ? 'red.500' : saveState === 'saved' ? 'green.600' : 'slate.400'}>
								{SAVE_LABEL[saveState]}
							</Text>
						)}
					</Box>
					<HStack spacing={2} flexWrap="wrap">
						<Menu>
							<MenuButton as={Button} size="sm" variant="outline" rightIcon={<ChevronDownIcon />} isDisabled={!rows.length}>
								Quick fill
							</MenuButton>
							<MenuList fontSize="sm">
								<MenuItem onClick={() => fillAll(true)}>{`Fill blank days with ${brush || 'blank'}`}</MenuItem>
								<MenuItem onClick={() => fillAll(false)}>{`Set every working day to ${brush || 'blank'}`}</MenuItem>
								<MenuDivider />
								<MenuItem color="red.600" icon={<DeleteIcon />} onClick={() => setIsClearOpen(true)}>Clear the whole sheet</MenuItem>
							</MenuList>
						</Menu>
						<ActionButton tone="neutral" size="sm" leftIcon={<DownloadIcon />} isLoading={exporting === 'pdf'} isDisabled={!rows.length || Boolean(exporting)} onClick={() => void exportSheet('pdf')}>
							PDF
						</ActionButton>
						<ActionButton tone="neutral" size="sm" leftIcon={<DownloadIcon />} isLoading={exporting === 'excel'} isDisabled={!rows.length || Boolean(exporting)} onClick={() => void exportSheet('excel')}>
							Excel
						</ActionButton>
						<ActionButton tone="neutral" size="sm" leftIcon={<PrintIcon boxSize={4} />} isLoading={exporting === 'print'} isDisabled={!rows.length || Boolean(exporting)} onClick={() => void exportSheet('print')}>
							Print
						</ActionButton>
					</HStack>
				</Flex>

				<Flex px={{ base: 3, md: 4 }} py={2.5} gap={2} align="center" flexWrap="wrap" bg="slate.50" borderBottom="1px solid" borderColor="slate.100">
					<Text fontSize="xs" fontWeight="600" color="slate.600" mr={1}>Click to fill with:</Text>
					{BRUSHES.map((mark) => {
						const style = REGISTER_MARK_META[mark];
						const isActive = brush === mark;
						return (
							<Tooltip key={mark || 'blank'} label={brushLabel(mark)} hasArrow>
								<Button
									size="xs"
									minW="38px"
									h="28px"
									fontWeight="700"
									bg={isActive ? style.color : style.bg}
									color={isActive ? 'white' : style.color}
									border="1px solid"
									borderColor={isActive ? style.color : style.border}
									_hover={{ bg: isActive ? style.color : style.hover }}
									onClick={() => setBrush(mark)}
									aria-pressed={isActive}
								>
									{mark || '⌫'}
								</Button>
							</Tooltip>
						);
					})}
					<HStack spacing={1} ml={{ md: 'auto' }} color="slate.500" fontSize="xs">
						<InfoOutlineIcon />
						<Text>Click a day number to fill the whole column, or "Fill row" for one employee. Sundays stay blank.</Text>
					</HStack>
				</Flex>

				{isLoading ? (
					<Box p={4}><Skeleton h="240px" borderRadius="md" /></Box>
				) : loadError ? (
					<Box p={4}><Alert status="error" borderRadius="md">{loadError}</Alert></Box>
				) : rows.length === 0 ? (
					<EmptyState title="No active employees at this location" description="Employees placed at this location will appear here." />
				) : (
					<Box overflowX="auto">
						<Box as="table" fontSize="xs" sx={{ borderCollapse: 'separate', borderSpacing: 0 }} minW="100%">
							<Box as="thead">
								<Box as="tr">
									<Box as="th" position="sticky" left={0} zIndex={2} bg="white" minW={`${NAME_WIDTH}px`} textAlign="left" px={3} py={2} borderBottom="1px solid" borderColor="slate.200" color="slate.600">
										Employee
									</Box>
									{days.map((day) => {
										const isSunday = sundays.has(day - 1);
										return (
											<Box as="th" key={day} p={0.5} borderBottom="1px solid" borderColor="slate.200" bg={isSunday ? 'slate.100' : 'white'}>
												<Tooltip label={isSunday ? 'Sunday — weekly off' : `Fill day ${day} with ${brushLabel(brush)}`} hasArrow>
													<Box
														as="button"
														type="button"
														w={CELL_SIZE}
														py={1}
														borderRadius="md"
														cursor={isSunday ? 'not-allowed' : 'pointer'}
														_hover={isSunday ? undefined : { bg: 'brand.50' }}
														onClick={() => fillDay(day - 1)}
													>
														<Text fontSize="9px" color={isSunday ? 'red.400' : 'slate.400'}>{WEEKDAY[weekdayOf(month, day)]}</Text>
														<Text fontWeight="700" color="slate.700">{day}</Text>
													</Box>
												</Tooltip>
											</Box>
										);
									})}
									<Box as="th" px={2} borderBottom="1px solid" borderColor="slate.200" color="slate.600" whiteSpace="nowrap">Total P</Box>
								</Box>
							</Box>
							<Box as="tbody">
								{rows.map((row, rowIndex) => {
									const rowMarks = marks[row.employeeId] || [];
									return (
										<Box as="tr" key={row.employeeId} _hover={{ '& > td': { bg: 'slate.50' } }}>
											<Box as="td" position="sticky" left={0} zIndex={1} bg="white" px={3} py={1.5} borderBottom="1px solid" borderColor="slate.100">
												<Flex align="center" justify="space-between" gap={2}>
													<Box minW={0}>
														<Text fontWeight="600" color="slate.900" noOfLines={1}>{`${rowIndex + 1}. ${row.name}`}</Text>
														<Text fontSize="10px" color="slate.500" noOfLines={1}>{[row.parentName && `S/O ${row.parentName}`, row.skillCategory].filter(Boolean).join(' · ')}</Text>
													</Box>
													<Button size="xs" variant="ghost" color="brand.600" flexShrink={0} onClick={() => fillRow(row.employeeId)}>Fill row</Button>
												</Flex>
											</Box>
											{days.map((day) => {
												const dayIndex = day - 1;
												const isSunday = sundays.has(dayIndex);
												const mark = rowMarks[dayIndex] || '';
												const style = REGISTER_MARK_META[mark];
												return (
													<Box as="td" key={day} p={0.5} borderBottom="1px solid" borderColor="slate.100" bg={isSunday ? 'slate.100' : undefined}>
														<Box
															as="button"
															type="button"
															aria-label={`${row.name}, day ${day}: ${mark ? REGISTER_MARK_META[mark].label : 'blank'}`}
															w={CELL_SIZE}
															h={CELL_SIZE}
															borderRadius="md"
															border="1px solid"
															borderColor={isSunday ? 'transparent' : style.border}
															bg={isSunday ? 'transparent' : style.bg}
															color={style.color}
															fontWeight="700"
															fontSize="10px"
															cursor={isSunday ? 'not-allowed' : 'pointer'}
															_hover={isSunday ? undefined : { bg: style.hover }}
															onClick={() => setCell(row.employeeId, dayIndex)}
														>
															{isSunday ? '' : mark}
														</Box>
													</Box>
												);
											})}
											<Box as="td" px={2} textAlign="center" fontWeight="700" color="slate.900" borderBottom="1px solid" borderColor="slate.100">
												{presentTotal(rowMarks)}
											</Box>
										</Box>
									);
								})}
							</Box>
						</Box>
					</Box>
				)}
			</Box>

			<ConfirmDialog
				isOpen={isClearOpen}
				title="Clear the whole sheet?"
				description="All marks you entered for this location and month will be removed."
				confirmLabel="Clear sheet"
				isLoading={isClearing}
				onClose={() => setIsClearOpen(false)}
				onConfirm={() => void clearAll()}
			/>
		</Stack>
	);
}

export default AttendanceSheetPage;
