import { CalendarIcon, CheckCircleIcon, DeleteIcon, DownloadIcon, EditIcon, InfoOutlineIcon, ViewIcon } from '@chakra-ui/icons';
import {
	Alert,
	AlertIcon,
	Box,
	Button,
	HStack,
	Skeleton,
	Stack,
	Text,
	useToast,
} from '@chakra-ui/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
	ActionButton,
	ConfirmDialog,
	ContentCard,
	DataTable,
	FileIcon,
	FilterBar,
	FilterField,
	FilterInput,
	IconAction,
	PrintIcon,
	StatStrip,
	TableFooter,
	WalletIcon,
	type DataTableColumn,
} from '../../components/ui';
import { ApiError } from '../../services/api';
import {
	deleteInvoice,
	getInvoicePreview,
	listInvoices,
	logInvoiceActivity,
	saveInvoice,
	type ClientInvoice,
	type InvoiceItem,
	type InvoicePreview,
	type InvoiceSetup,
} from '../../services/invoiceService';
import InvoiceDetailView from './components/InvoiceDetailView';
import InvoiceMonthEditor, { type InvoiceDraft } from './components/InvoiceMonthEditor';
import InvoiceSetupDialog from './components/InvoiceSetupDialog';
import { computeTotals, dmy, money, type InvoiceDocument } from './utils/invoiceDocument';
import { exportInvoiceExcel, exportInvoicePdf } from './utils/invoiceExport';

type LocationInvoicePageProps = {
	organizationId: string;
	locationId: string;
};

type Draft = InvoiceDraft;

type ExportKind = 'pdf' | 'excel' | 'print';

const INVOICES_PER_PAGE = 10;

const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
const ACTION_LABELS: Record<ClientInvoice['activity'][number]['action'], string> = { save: 'Saved', pdf: 'PDF', excel: 'Excel', print: 'Printed' };

function monthValue(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function previousMonth() {
	const today = new Date();
	return monthValue(new Date(today.getFullYear(), today.getMonth() - 1, 1));
}

function monthLabel(month: string) {
	const [year, number] = month.split('-').map(Number);
	return `${MONTH_NAMES[number - 1] ?? ''}-${year}`;
}

function errorMessage(error: unknown, fallback: string) {
	return error instanceof ApiError ? error.message : fallback;
}

function round(value: number, decimals = 2) {
	const factor = 10 ** decimals;
	return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** A saved invoice stays exactly as billed; only the rate labels are borrowed from the month's calculation. */
function withSavedRates(saved: InvoiceItem[], current: InvoiceItem[]): InvoiceItem[] {
	if (saved.length !== current.length) return saved;
	return saved.map((item, index) => ({ ...item, rateSource: current[index].rateSource, rateDetail: current[index].rateDetail }));
}

function draftFrom(preview: InvoicePreview): Draft {
	if (preview.invoice) {
		return {
			invoiceNumber: preview.invoice.invoiceNumber,
			invoiceDate: preview.invoice.invoiceDate,
			raBillNo: preview.invoice.raBillNo,
			items: withSavedRates(preview.invoice.items, preview.items),
		};
	}
	return { ...preview.suggested, items: preview.items };
}

function sameDraft(left: Draft, right: Draft) {
	const plain = (draft: Draft) => JSON.stringify({
		...draft,
		items: draft.items.map(({ description, unit, qty, rate, section }) => ({ description, unit, qty, rate, section })),
	});
	return plain(left) === plain(right);
}

function LocationInvoicePage({ organizationId, locationId }: LocationInvoicePageProps) {
	const toast = useToast();
	const [month, setMonth] = useState(previousMonth);
	const [preview, setPreview] = useState<InvoicePreview | null>(null);
	const [draft, setDraft] = useState<Draft | null>(null);
	const [savedDraft, setSavedDraft] = useState<Draft | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [busy, setBusy] = useState<ExportKind | 'save' | null>(null);
	const [invoices, setInvoices] = useState<ClientInvoice[]>([]);
	const [invoicesLoading, setInvoicesLoading] = useState(true);
	const [invoicesPage, setInvoicesPage] = useState(1);
	const [isSetupOpen, setIsSetupOpen] = useState(false);
	const [setupTab, setSetupTab] = useState(0);
	const [deleting, setDeleting] = useState<ClientInvoice | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		if (!/^\d{4}-\d{2}$/.test(month)) return undefined;
		const controller = new AbortController();
		setIsLoading(true);
		setLoadError('');
		void getInvoicePreview(organizationId, locationId, month, controller.signal)
			.then((result) => {
				const next = draftFrom(result);
				setPreview(result);
				setDraft(next);
				setSavedDraft(result.invoice ? { ...next, items: result.invoice.items } : null);
			})
			.catch((error: unknown) => {
				if (controller.signal.aborted) return;
				setPreview(null);
				setLoadError(errorMessage(error, 'Unable to prepare the invoice.'));
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [locationId, month, organizationId, refreshKey]);

	const loadInvoices = useCallback((signal?: AbortSignal) => {
		setInvoicesLoading(true);
		void listInvoices(organizationId, locationId, signal)
			.then(setInvoices)
			.catch(() => {
				if (!signal?.aborted) setInvoices([]);
			})
			.finally(() => {
				if (!signal?.aborted) setInvoicesLoading(false);
			});
	}, [locationId, organizationId]);

	useEffect(() => {
		const controller = new AbortController();
		loadInvoices(controller.signal);
		return () => controller.abort();
	}, [loadInvoices]);

	const document = useMemo<InvoiceDocument | null>(() => {
		if (!preview || !draft) return null;
		const { setup, settings, period } = preview;
		return {
			settings,
			period,
			invoiceNumber: draft.invoiceNumber,
			invoiceDate: draft.invoiceDate,
			raBillNo: draft.raBillNo,
			partyName: settings.partyName,
			vendorCode: setup.vendorCode || settings.vendorCode,
			workTitle: setup.workTitle || setup.defaultWorkTitle,
			loaNumber: setup.loaNumber || setup.defaultLoaNumber,
			loaDate: setup.loaDate,
			sapPo: setup.sapPo || setup.defaultSapPo,
			billToNote: setup.billToNote,
			gstLabel: setup.gstLabel,
			gstRate: setup.gstRate,
			items: draft.items,
			...computeTotals(draft.items, setup.gstRate),
		};
	}, [draft, preview]);

	function updateItem(index: number, patch: Partial<InvoiceItem>) {
		setDraft((current) => {
			if (!current) return current;
			const items = current.items.map((item, position) => {
				if (position !== index) return item;
				const next = { ...item, ...patch };
				return { ...next, amount: round(next.qty * next.rate) };
			});
			return { ...current, items };
		});
	}

	function openSetup(tab: number) {
		setSetupTab(tab);
		setIsSetupOpen(true);
	}

	function recalculate() {
		if (!preview) return;
		setDraft((current) => (current ? { ...current, items: preview.items } : current));
		toast({ title: 'Quantities refreshed from attendance', status: 'info', position: 'top', duration: 2500 });
	}

	async function persist() {
		if (!draft || !preview) throw new Error('Nothing to save.');
		const invoice = await saveInvoice(organizationId, locationId, month, draft);
		const next: Draft = { invoiceNumber: invoice.invoiceNumber, invoiceDate: invoice.invoiceDate, raBillNo: invoice.raBillNo, items: withSavedRates(invoice.items, preview.items) };
		setDraft(next);
		setSavedDraft({ ...next, items: invoice.items });
		setPreview((current) => (current ? { ...current, invoice } : current));
		loadInvoices();
		return invoice;
	}

	async function save() {
		setBusy('save');
		try {
			const invoice = await persist();
			toast({ title: `Invoice ${invoice.invoiceNumber} saved`, status: 'success', position: 'top' });
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to save the invoice.'), status: 'error', position: 'top' });
		} finally {
			setBusy(null);
		}
	}

	async function runExport(kind: ExportKind) {
		if (!document) return;
		setBusy(kind);
		try {
			const invoice = savedDraft && draft && sameDraft(savedDraft, draft) && preview?.invoice ? preview.invoice : await persist();
			const exportDocument = { ...document, invoiceNumber: invoice.invoiceNumber, raBillNo: invoice.raBillNo };
			if (kind === 'excel') await exportInvoiceExcel(exportDocument);
			else await exportInvoicePdf(exportDocument, kind === 'print' ? 'print' : 'download');
			const logged = await logInvoiceActivity(organizationId, locationId, invoice.id, kind).catch(() => null);
			if (logged) {
				setPreview((current) => (current ? { ...current, invoice: logged } : current));
				loadInvoices();
			}
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to export the invoice.'), status: 'error', position: 'top' });
		} finally {
			setBusy(null);
		}
	}

	async function confirmDelete() {
		if (!deleting) return;
		setIsDeleting(true);
		try {
			await deleteInvoice(organizationId, locationId, deleting.id);
			toast({ title: `Invoice ${deleting.invoiceNumber} deleted`, status: 'success', position: 'top' });
			loadInvoices();
			if (deleting.month === month) setRefreshKey((key) => key + 1);
		} catch (error) {
			toast({ title: errorMessage(error, 'Unable to delete the invoice.'), status: 'error', position: 'top' });
		} finally {
			setIsDeleting(false);
			setDeleting(null);
		}
	}

	function setupSaved(setup: InvoiceSetup) {
		setIsSetupOpen(false);
		setPreview((current) => (current ? { ...current, setup } : current));
		setRefreshKey((key) => key + 1);
		toast({ title: 'Invoice setup saved', status: 'success', position: 'top' });
	}

	const isDirty = Boolean(draft && (!savedDraft || !sameDraft(savedDraft, draft)));
	const isPastMonth = month < monthValue(new Date());
	const missingRates = draft?.items.some((item) => item.section === 'service' && item.rate === 0) ?? false;
	const invoicesTotalPages = Math.max(1, Math.ceil(invoices.length / INVOICES_PER_PAGE));
	const currentInvoicesPage = Math.min(invoicesPage, invoicesTotalPages);
	const setupIncomplete = preview ? !(preview.setup.loaNumber || preview.setup.defaultLoaNumber) : false;
	const canAct = Boolean(document) && !isLoading && !busy;
	const lastActivity = preview?.invoice?.activity.at(-1);

	const historyColumns: DataTableColumn<ClientInvoice>[] = [
		{ key: 'month', header: 'Month', render: (invoice) => <Text fontWeight="700" color="slate.900">{monthLabel(invoice.month)}</Text> },
		{ key: 'number', header: 'Invoice no.', render: (invoice) => <Text color="slate.700">{invoice.invoiceNumber}</Text> },
		{ key: 'ra', header: 'RA bill', align: 'right', hideBelow: 'md', render: (invoice) => invoice.raBillNo },
		{ key: 'date', header: 'Dated', hideBelow: 'md', render: (invoice) => dmy(invoice.invoiceDate) },
		{ key: 'net', header: 'Net payable', align: 'right', render: (invoice) => <Text fontWeight="800" color="slate.900">₹{money(invoice.netPayable)}</Text> },
		{
			key: 'activity',
			header: 'Last activity',
			hideBelow: 'lg',
			render: (invoice) => {
				const entry = invoice.activity.at(-1);
				return entry ? (
					<Text fontSize="xs" color="slate.500">
						{ACTION_LABELS[entry.action]} · {new Date(entry.at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}{entry.byName ? ` · ${entry.byName}` : ''}
					</Text>
				) : '—';
			},
		},
		{
			key: 'actions',
			header: '',
			align: 'right',
			render: (invoice) => (
				<HStack spacing={1.5} justify="flex-end">
					<IconAction label="Open this invoice" icon={<ViewIcon />} onClick={() => setMonth(invoice.month)} />
					<IconAction label="Delete invoice" tone="danger" icon={<DeleteIcon />} onClick={() => setDeleting(invoice)} />
				</HStack>
			),
		},
	];

	return (
		<Stack spacing={5}>
			<StatStrip
				items={[
					{
						label: 'Man-days',
						value: preview ? preview.attendance.totalManDays : null,
						helper: preview
							? preview.attendance.categories.map((category) => `${category.skillCategory} ${category.manDays}`).join(' · ') || 'No attendance this month'
							: 'From attendance',
						color: 'blue.500',
						icon: <CalendarIcon />,
					},
					{ label: 'Service part', value: document ? `₹${money(document.serviceTotal)}` : null, helper: document ? `Supply items ₹${money(document.supplyTotal)}` : 'Taxable total', color: 'brand.500', icon: <FileIcon boxSize={5} /> },
					{ label: preview ? `${preview.setup.gstLabel} ${preview.setup.gstRate}%` : 'Tax', value: document ? `₹${money(document.gstAmount)}` : null, helper: 'On the service part', color: 'orange.400', icon: <CheckCircleIcon /> },
					{ label: 'Net payable', value: document ? `₹${money(document.netPayable)}` : null, helper: preview?.invoice ? `Saved as ${preview.invoice.invoiceNumber}` : 'Not saved yet', color: 'green.500', icon: <WalletIcon boxSize={5} /> },
				]}
			/>

			<ContentCard
				noPadding
				icon={<FileIcon boxSize={5} />}
				title="Invoice breakup"
				subtitle={preview ? `Period ${preview.period.label} · quantities from attendance` : 'Monthly client invoice for this location'}
				actions={(
					<>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<EditIcon />} isDisabled={!preview} onClick={() => openSetup(0)}>
							Invoice setup
						</ActionButton>
						<ActionButton size="sm" borderRadius="full" isDisabled={!canAct || !isDirty} isLoading={busy === 'save'} onClick={() => void save()}>
							{preview?.invoice ? 'Save changes' : 'Save invoice'}
						</ActionButton>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canAct} isLoading={busy === 'pdf'} onClick={() => void runExport('pdf')}>
							PDF
						</ActionButton>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<DownloadIcon />} isDisabled={!canAct} isLoading={busy === 'excel'} onClick={() => void runExport('excel')}>
							Excel
						</ActionButton>
						<ActionButton tone="neutral" size="sm" borderRadius="full" leftIcon={<PrintIcon boxSize={4} />} isDisabled={!canAct} isLoading={busy === 'print'} onClick={() => void runExport('print')}>
							Print
						</ActionButton>
					</>
				)}
				toolbar={(
					<FilterBar variant="inset">
						<FilterField label="Quick month" flex={{ base: '1 1 100%', md: '0 0 auto' }}>
							<HStack spacing={1} p={1} h="40px" bg="white" border="1px solid" borderColor="slate.200" borderRadius="10px">
								{[{ label: 'Last month', value: previousMonth() }, { label: 'This month', value: monthValue(new Date()) }].map((preset) => (
									<Button
										key={preset.label}
										size="xs"
										h="30px"
										px={3}
										borderRadius="8px"
										fontWeight="600"
										variant="ghost"
										bg={preset.value === month ? 'brand.500' : 'transparent'}
										color={preset.value === month ? 'white' : 'slate.600'}
										_hover={{ bg: preset.value === month ? 'brand.600' : 'slate.100' }}
										onClick={() => setMonth(preset.value)}
									>
										{preset.label}
									</Button>
								))}
							</HStack>
						</FilterField>
						<FilterField label="Month" flex={{ base: '1 1 100%', md: '0 0 200px' }}>
							<FilterInput aria-label="Invoice month" type="month" value={month} max={monthValue(new Date())} onChange={(event) => event.target.value && setMonth(event.target.value)} />
						</FilterField>
					</FilterBar>
				)}
			>
				{loadError ? (
					<Box p={4}><Alert status="error" borderRadius="md"><AlertIcon />{loadError}</Alert></Box>
				) : !preview || !draft || !document ? (
					<Stack p={5} spacing={3}>
						<Skeleton h="56px" borderRadius="md" />
						<Skeleton h="240px" borderRadius="md" />
					</Stack>
				) : (
					<Stack spacing={0}>
						{setupIncomplete || missingRates || isDirty || isPastMonth ? (
							<Stack px={{ base: 4, md: 5 }} pt={4} spacing={2}>
								{isPastMonth ? (
									<Alert status="info" borderRadius="md" fontSize="sm">
										<AlertIcon />
										{preview.invoice
											? `Saved invoice of ${preview.period.label} — shown exactly as it was billed, rates are not changed by later wage updates.`
											: `Rates as valid in ${preview.period.label}: labour wages from Category of skill and EPF / ESIC / Bonus % from Settings → Invoice of that month, not today's.`}
									</Alert>
								) : null}
								{setupIncomplete ? (
									<Alert status="warning" borderRadius="md" fontSize="sm">
										<AlertIcon />
										No LOA number yet. Add it on the location (Edit location → LOA reference) or in Invoice setup → Contract & rates. Everything else fills automatically.
									</Alert>
								) : null}
								{missingRates ? (
									<Alert status="warning" borderRadius="md" fontSize="sm">
										<AlertIcon />
										Some service lines have no rate. Rates come from the employees' daily wage — set Daily salary on those employees (or the skill category rate).
									</Alert>
								) : null}
								{isDirty && preview.invoice ? (
									<Alert status="info" borderRadius="md" fontSize="sm">
										<AlertIcon />
										Changes not saved yet. PDF, Excel and Print save them first.
									</Alert>
								) : null}
							</Stack>
						) : null}

						<InvoiceDetailView invoice={document} employees={preview.attendance.employees} onEdit={() => openSetup(0)} />

						<HStack px={{ base: 4, md: 5 }} py={3} spacing={2} align="flex-start" fontSize="xs" color="slate.500" bg="slate.50" borderTop="1px solid" borderColor="slate.100">
							<InfoOutlineIcon mt="2px" />
							<Text>
								PDF, Excel and Print use the official Invoice Breakup layout. Company name, vendor code and signature come from Settings → Invoice.
								{lastActivity ? ` Last: ${ACTION_LABELS[lastActivity.action]}${lastActivity.byName ? ` by ${lastActivity.byName}` : ''}.` : ''}
							</Text>
						</HStack>
					</Stack>
				)}
			</ContentCard>

			<ContentCard noPadding icon={<FileIcon boxSize={5} />} title="Saved invoices" subtitle="One invoice per month for this location">
				<DataTable
					columns={historyColumns}
					rows={invoices.slice((currentInvoicesPage - 1) * INVOICES_PER_PAGE, currentInvoicesPage * INVOICES_PER_PAGE)}
					rowKey={(invoice) => invoice.id}
					size="sm"
					isLoading={invoicesLoading}
					emptyTitle="No invoices saved yet"
					emptyDescription="Save or export an invoice above and it appears here."
				/>
				<TableFooter
					page={currentInvoicesPage}
					pageSize={INVOICES_PER_PAGE}
					total={invoices.length}
					totalPages={invoicesTotalPages}
					noun="invoices"
					isDisabled={invoicesLoading}
					onPageChange={setInvoicesPage}
				/>
			</ContentCard>

			{preview ? (
				<InvoiceSetupDialog
					isOpen={isSetupOpen}
					organizationId={organizationId}
					locationId={locationId}
					setup={preview.setup}
					skillCategories={preview.attendance.categories.map((category) => category.skillCategory)}
					autoLabourLines={preview.items.filter((item) => item.section === 'service' && item.rateSource === 'auto')}
					monthDays={preview.settings.monthDays || '26'}
					onClose={() => setIsSetupOpen(false)}
					onSaved={setupSaved}
					initialTab={setupTab}
					monthTab={{
						label: `This month · ${preview.period.label}`,
						content: draft ? (
							<InvoiceMonthEditor
								periodLabel={preview.period.label}
								draft={draft}
								isSaved={Boolean(preview.invoice)}
								onChange={setDraft}
								onItemChange={updateItem}
								onRefill={recalculate}
							/>
						) : null,
						saveLabel: preview.invoice ? 'Save changes' : 'Save invoice',
						canSave: canAct && isDirty,
						isSaving: busy === 'save',
						onSave: () => void save(),
					}}
				/>
			) : null}

			<ConfirmDialog
				isOpen={Boolean(deleting)}
				title={deleting ? `Delete invoice ${deleting.invoiceNumber}?` : 'Delete invoice?'}
				description={deleting ? `The ${monthLabel(deleting.month)} invoice will be removed. Its number can then be used again.` : ''}
				confirmLabel="Delete invoice"
				isLoading={isDeleting}
				onClose={() => setDeleting(null)}
				onConfirm={() => void confirmDelete()}
			/>
		</Stack>
	);
}

export default LocationInvoicePage;
