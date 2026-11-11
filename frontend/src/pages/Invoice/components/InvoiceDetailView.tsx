import { EditIcon } from '@chakra-ui/icons';
import { Accordion, AccordionButton, AccordionIcon, AccordionItem, AccordionPanel, Box, Flex, HStack, SimpleGrid, Stack, Text } from '@chakra-ui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { ActionButton, DataTable, TableFooter, type DataTableColumn } from '../../../components/ui';
import type { InvoiceEmployeeBreakdown } from '../../../services/invoiceService';
import { amountInWords, dmy, money, tableRows, type InvoiceDocument, type InvoiceTableRow } from '../utils/invoiceDocument';

type InvoiceDetailViewProps = {
	invoice: InvoiceDocument;
	employees: InvoiceEmployeeBreakdown[];
	onEdit: () => void;
};

const EMPLOYEES_PER_PAGE = 10;

function days(value: number) {
	return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function EmployeeBreakdown({ employees }: { employees: InvoiceEmployeeBreakdown[] }) {
	const total = (pick: (employee: InvoiceEmployeeBreakdown) => number) => employees.reduce((sum, employee) => sum + pick(employee), 0);
	const working = employees.filter((employee) => employee.paidDays > 0).length;
	const totalSalary = total((employee) => employee.salary);
	const totalPages = Math.max(1, Math.ceil(employees.length / EMPLOYEES_PER_PAGE));
	const [page, setPage] = useState(1);
	useEffect(() => setPage(1), [employees]);
	const currentPage = Math.min(page, totalPages);
	const pageRows = employees.slice((currentPage - 1) * EMPLOYEES_PER_PAGE, currentPage * EMPLOYEES_PER_PAGE);

	const columns: DataTableColumn<InvoiceEmployeeBreakdown>[] = [
		{
			key: 'name',
			header: 'Employee',
			render: (employee) => (
				<Box minW="160px">
					<Text fontWeight="600" color="slate.900">{employee.name}</Text>
					{employee.designation ? <Text fontSize="xs" color="slate.500">{employee.designation}</Text> : null}
				</Box>
			),
		},
		{ key: 'skill', header: 'Skill', render: (employee) => <Text color="slate.700">{employee.skillCategory || 'Not set'}</Text> },
		{ key: 'present', header: 'Present', align: 'right', render: (employee) => days(employee.presentDays) },
		{ key: 'half', header: 'Half day', align: 'right', hideBelow: 'md', render: (employee) => days(employee.halfDays) },
		{ key: 'paidLeave', header: 'Paid leave', align: 'right', hideBelow: 'md', render: (employee) => days(employee.paidLeaveDays) },
		{ key: 'leave', header: 'Other leave', align: 'right', hideBelow: 'lg', render: (employee) => days(employee.otherLeaveDays) },
		{ key: 'absent', header: 'Absent', align: 'right', hideBelow: 'md', render: (employee) => days(employee.absentDays) },
		{
			key: 'paid',
			header: 'Paid days',
			align: 'right',
			render: (employee) => (
				<Box as="span" display="inline-block" px={2.5} py={0.5} borderRadius="full" bg="blue.50" color="blue.700" fontWeight="700" fontSize="xs">{days(employee.paidDays)}</Box>
			),
		},
		{
			key: 'daily',
			header: 'Daily wage',
			align: 'right',
			render: (employee) => (
				<Box whiteSpace="nowrap">
					<Text color="slate.700">₹{money(employee.dailySalary)}</Text>
					<Text fontSize="xs" color="slate.500">Basic ₹{money(employee.basicPay)} + DA ₹{money(employee.dearnessAllowance)}</Text>
				</Box>
			),
		},
		{ key: 'salary', header: 'Salary', align: 'right', render: (employee) => <Text fontWeight="700" color="slate.900" whiteSpace="nowrap">₹{money(employee.salary)}</Text> },
	];

	return (
		<Accordion allowToggle border="1px solid" borderColor="slate.200" borderRadius="md" overflow="hidden">
			<AccordionItem border="none">
				<AccordionButton px={4} py={3} bg="slate.50" _hover={{ bg: 'slate.100' }}>
					<Box flex="1" textAlign="left">
						<Text fontWeight="700" color="slate.900">Employee breakdown</Text>
						<Text fontSize="xs" color="slate.500">
							{employees.length} employees · {working} working · {days(total((employee) => employee.paidDays))} paid days · salary ₹{money(totalSalary)}
						</Text>
					</Box>
					<AccordionIcon />
				</AccordionButton>
				<AccordionPanel p={0}>
					<DataTable
						columns={columns}
						rows={pageRows}
						rowKey={(employee) => employee.employeeId}
						size="sm"
						emptyTitle="No employees"
						emptyDescription="No employees are assigned to this location for this month."
						summary={employees.length ? {
							name: <Text>Total</Text>,
							present: days(total((employee) => employee.presentDays)),
							half: days(total((employee) => employee.halfDays)),
							paidLeave: days(total((employee) => employee.paidLeaveDays)),
							leave: days(total((employee) => employee.otherLeaveDays)),
							absent: days(total((employee) => employee.absentDays)),
							paid: days(total((employee) => employee.paidDays)),
							salary: <Text fontWeight="800" color="slate.900" whiteSpace="nowrap">₹{money(totalSalary)}</Text>,
						} : undefined}
					/>
					<TableFooter
						page={currentPage}
						pageSize={EMPLOYEES_PER_PAGE}
						total={employees.length}
						totalPages={totalPages}
						noun="employees"
						onPageChange={setPage}
					/>
				</AccordionPanel>
			</AccordionItem>
		</Accordion>
	);
}

function Field({ label, value, span }: { label: string; value?: ReactNode; span?: number }) {
	const empty = value === undefined || value === null || value === '';
	return (
		<Box gridColumn={span ? { md: `span ${span}` } : undefined} p={3} bg="slate.50" border="1px solid" borderColor="slate.100" borderRadius="md" minW={0}>
			<Text fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="slate.400">{label}</Text>
			<Text mt={0.5} fontSize="sm" fontWeight="600" color={empty ? 'slate.400' : 'slate.900'} whiteSpace="pre-line">
				{empty ? 'Not added' : value}
			</Text>
		</Box>
	);
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
	return (
		<Flex justify="space-between" align="center" gap={3} mb={3}>
			<Text fontWeight="700" color="slate.900">{children}</Text>
			{action}
		</Flex>
	);
}

function InvoiceDetailView({ invoice, employees, onEdit }: InvoiceDetailViewProps) {
	const { rows } = tableRows(invoice);
	const items = rows.filter((row) => !row.isTotal);
	const serviceTotalRow = rows.find((row) => row.isTotal);

	const columns: DataTableColumn<InvoiceTableRow>[] = [
		{ key: 'serial', header: '#', width: '48px', render: (row) => <Text color="slate.500" fontWeight="600">{row.serial}</Text> },
		{
			key: 'description',
			header: 'Description of work',
			render: (row) => {
				const [first, ...rest] = row.description.split('\n');
				return (
					<Box minW="240px">
						<Text fontWeight="600" color="slate.900">{first}</Text>
						{rest.length ? <Text fontSize="xs" color="slate.500" whiteSpace="pre-line">{rest.join('\n')}</Text> : null}
					</Box>
				);
			},
		},
		{ key: 'unit', header: 'Unit', hideBelow: 'md', render: (row) => <Text color="slate.600">{row.unit || '—'}</Text> },
		{
			key: 'qty',
			header: 'Qty',
			align: 'right',
			render: (row) => (
				<Box as="span" display="inline-block" px={2.5} py={0.5} borderRadius="full" bg="blue.50" color="blue.700" fontWeight="700" fontSize="xs">{row.qty}</Box>
			),
		},
		{ key: 'rate', header: 'Rate', align: 'right', render: (row) => <Text color="slate.700" whiteSpace="nowrap">₹{row.rate}</Text> },
		{ key: 'amount', header: 'Amount', align: 'right', render: (row) => <Text fontWeight="700" color="slate.900" whiteSpace="nowrap">₹{row.amount}</Text> },
	];

	const totals = [
		{ label: 'Service part', value: invoice.serviceTotal },
		{ label: 'Supply items', value: invoice.supplyTotal },
		{ label: 'Total', value: invoice.grandTotal },
		{ label: `${invoice.gstLabel} @${Number(invoice.gstRate)}% on service part`, value: invoice.gstAmount },
	];

	return (
		<Stack spacing={6} px={{ base: 4, md: 5 }} py={5}>
			<Box>
				<SectionTitle action={(
					<ActionButton size="sm" tone="neutral" borderRadius="full" leftIcon={<EditIcon />} onClick={onEdit}>
						Edit invoice lines
					</ActionButton>
				)}>
					Invoice details
				</SectionTitle>
				<SimpleGrid columns={{ base: 1, sm: 2, md: 4 }} spacing={3}>
					<Field label="Invoice no." value={invoice.invoiceNumber} />
					<Field label="Dated" value={dmy(invoice.invoiceDate)} />
					<Field label="RA bill no." value={invoice.raBillNo === '' ? '' : String(invoice.raBillNo)} />
					<Field label="Period" value={`${invoice.period.label} (${invoice.period.fromDate} to ${invoice.period.toDate})`} />
					<Field label="Name of party" value={invoice.partyName} span={2} />
					<Field label="Vendor code" value={invoice.vendorCode} />
					<Field label="SAP PO" value={invoice.sapPo} />
					<Field label="Name of work" value={invoice.workTitle} span={2} />
					<Field label="LOA / GeM contract" value={invoice.loaNumber} />
					<Field label="LOA date" value={invoice.loaDate ? dmy(invoice.loaDate) : ''} />
				</SimpleGrid>
			</Box>

			<Box>
				<SectionTitle>Invoice lines</SectionTitle>
				<Box border="1px solid" borderColor="slate.200" borderRadius="md" overflow="hidden">
					<DataTable
						columns={columns}
						rows={items}
						rowKey={(row) => `${row.serial}-${row.description}`}
						size="sm"
						emptyTitle="No invoice lines"
						emptyDescription="Add lines in Invoice setup → Contract & rates."
						summary={serviceTotalRow ? {
							description: <Text>Service part total</Text>,
							qty: serviceTotalRow.qty,
							amount: <Text fontWeight="800" color="slate.900" whiteSpace="nowrap">₹{serviceTotalRow.amount}</Text>,
						} : undefined}
					/>
				</Box>
			</Box>

			<SimpleGrid columns={{ base: 1, lg: 2 }} spacing={4} alignItems="start">
				<Stack spacing={3}>
					<Box p={4} bg="slate.50" border="1px solid" borderColor="slate.100" borderRadius="md">
						<Text fontSize="11px" fontWeight="700" letterSpacing="0.06em" textTransform="uppercase" color="slate.400">Amount in words</Text>
						<Text mt={1} fontWeight="600" color="slate.900">Rs. {amountInWords(invoice.netPayable)}</Text>
					</Box>
					{invoice.billToNote ? <Field label="Footer note" value={invoice.billToNote} /> : null}
				</Stack>
				<Box border="1px solid" borderColor="slate.200" borderRadius="md" overflow="hidden">
					{totals.map((line) => (
						<HStack key={line.label} justify="space-between" px={4} py={2.5} borderBottom="1px solid" borderColor="slate.100" fontSize="sm">
							<Text color="slate.600">{line.label}</Text>
							<Text fontWeight="600" color="slate.900">₹{money(line.value)}</Text>
						</HStack>
					))}
					<HStack justify="space-between" px={4} py={3} bg="green.50">
						<Text fontWeight="700" color="green.800">Net payable amount</Text>
						<Text fontWeight="800" fontSize="lg" color="green.700">₹{money(invoice.netPayable)}</Text>
					</HStack>
				</Box>
			</SimpleGrid>

			<EmployeeBreakdown employees={employees} />
		</Stack>
	);
}

export default InvoiceDetailView;
