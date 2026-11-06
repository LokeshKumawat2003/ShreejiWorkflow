import { AddIcon, DeleteIcon } from '@chakra-ui/icons';
import { Alert, Badge, Box, HStack, IconButton, Input, Select, SimpleGrid, Stack, Text, useToast } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import { ActionButton, ContentCard } from '../../../components/ui';
import { ApiError } from '../../../services/api';
import { getAttendanceSymbols, saveAttendanceSymbols, type AttendanceSymbol } from '../../../services/attendanceService';
import { ATTENDANCE_STATUS_META, ATTENDANCE_STATUS_OPTIONS } from '../../Attendance/utils/attendanceStatus';

const BUILT_IN_MARKS: { marks: string; status: keyof typeof ATTENDANCE_STATUS_META }[] = [
	{ marks: 'P, PR, Present, ✓, ✔, √, ticked circle', status: 'present' },
	{ marks: 'A, AB, Absent, X, ✗, ✘, crossed circle', status: 'absent' },
	{ marks: 'HD, Half, Half day, ½', status: 'half_day' },
	{ marks: 'L, Leave', status: 'leave' },
	{ marks: 'CL', status: 'casual_leave' },
	{ marks: 'SL, ML', status: 'sick_leave' },
	{ marks: 'PL, EL', status: 'paid_leave' },
	{ marks: 'WO, W/O, Off', status: 'weekly_off' },
	{ marks: 'H, Hol, Holiday, PH', status: 'holiday' },
];

type Row = AttendanceSymbol & { key: number };

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ApiError ? error.message : fallback;
}

function AttendanceSymbolsPanel() {
	const toast = useToast();
	const [rows, setRows] = useState<Row[]>([]);
	const [saved, setSaved] = useState<AttendanceSymbol[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState('');
	const [nextKey, setNextKey] = useState(0);

	function load(symbols: AttendanceSymbol[]) {
		setSaved(symbols);
		setRows(symbols.map((symbol, index) => ({ ...symbol, key: index })));
		setNextKey(symbols.length);
	}

	useEffect(() => {
		let isActive = true;
		getAttendanceSymbols()
			.then((symbols) => {
				if (isActive) load(symbols);
			})
			.catch((caught: unknown) => {
				if (isActive) setError(errorMessage(caught, 'Unable to load attendance symbols.'));
			})
			.finally(() => {
				if (isActive) setIsLoading(false);
			});
		return () => {
			isActive = false;
		};
	}, []);

	const isDirty = JSON.stringify(rows.map(({ symbol, status }) => ({ symbol, status }))) !== JSON.stringify(saved);

	function updateRow(key: number, patch: Partial<AttendanceSymbol>) {
		setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
	}

	function addRow() {
		setRows((current) => [...current, { key: nextKey, symbol: '', status: 'present' }]);
		setNextKey((current) => current + 1);
	}

	async function save() {
		setIsSaving(true);
		setError('');
		try {
			const symbols = await saveAttendanceSymbols(rows.map(({ symbol, status }) => ({ symbol: symbol.trim(), status })));
			load(symbols);
			toast({ title: 'Attendance symbols saved', status: 'success', position: 'top' });
		} catch (caught) {
			setError(errorMessage(caught, 'Unable to save attendance symbols.'));
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<SimpleGrid columns={{ base: 1, xl: 2 }} spacing={5} alignItems="start">
			<ContentCard
				title="Custom attendance symbols"
				subtitle="Marks your registers use that are not built in. They are checked first when an uploaded register is read."
				actions={(
					<>
						<ActionButton tone="neutral" size="sm" isDisabled={!isDirty || isSaving} onClick={() => load(saved)}>Discard</ActionButton>
						<ActionButton size="sm" isLoading={isSaving} isDisabled={!isDirty || isLoading} onClick={() => void save()}>Save symbols</ActionButton>
					</>
				)}
			>
				<Stack spacing={3}>
					{error ? <Alert status="error">{error}</Alert> : null}
					{isLoading ? <Text fontSize="sm" color="slate.500">Loading symbols...</Text> : null}
					{!isLoading && rows.length === 0 ? (
						<Text fontSize="sm" color="slate.500">No custom symbols yet. The built-in marks are always recognised.</Text>
					) : null}
					{rows.map((row) => (
						<HStack key={row.key} spacing={3}>
							<Input
								aria-label="Symbol as written in the register"
								placeholder="e.g. D, OD, ●"
								maxLength={20}
								size="sm"
								maxW="160px"
								value={row.symbol}
								onChange={(event) => updateRow(row.key, { symbol: event.target.value })}
							/>
							<Text fontSize="sm" color="slate.400">means</Text>
							<Select
								aria-label={`Status for symbol ${row.symbol || 'new symbol'}`}
								size="sm"
								value={row.status}
								onChange={(event) => updateRow(row.key, { status: event.target.value as AttendanceSymbol['status'] })}
							>
								{ATTENDANCE_STATUS_OPTIONS.map((option) => (
									<option key={option.value} value={option.value}>{option.label}</option>
								))}
							</Select>
							<IconButton
								aria-label={`Remove symbol ${row.symbol || 'new symbol'}`}
								icon={<DeleteIcon />}
								size="sm"
								variant="ghost"
								colorScheme="red"
								onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
							/>
						</HStack>
					))}
					<Box>
						<ActionButton tone="neutral" size="sm" leftIcon={<AddIcon boxSize={3} />} isDisabled={isLoading} onClick={addRow}>
							Add symbol
						</ActionButton>
					</Box>
					<Text fontSize="xs" color="slate.500">
						Matching ignores case, dots and extra spaces. A custom symbol overrides a built-in mark with the same letters.
					</Text>
				</Stack>
			</ContentCard>
			<ContentCard title="Built-in marks" subtitle="Always recognised. Blank cells stay not marked; unclear marks are flagged for review.">
				<Stack spacing={2}>
					{BUILT_IN_MARKS.map(({ marks, status }) => (
						<HStack key={status} justify="space-between" spacing={3}>
							<Text fontSize="sm" color="slate.700">{marks}</Text>
							<Badge bg={ATTENDANCE_STATUS_META[status].bg} color={ATTENDANCE_STATUS_META[status].color} flexShrink={0}>
								{ATTENDANCE_STATUS_META[status].label}
							</Badge>
						</HStack>
					))}
				</Stack>
			</ContentCard>
		</SimpleGrid>
	);
}

export default AttendanceSymbolsPanel;
