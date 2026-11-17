import { Button, HStack, Select, Stack, Text, Textarea } from '@chakra-ui/react';
import { useEffect, useState } from 'react';
import {
	listAssistantFeedback,
	reviewAssistantFeedback,
	submitAssistantFeedback,
	type AssistantFeedbackSummary,
	type AssistantFeedbackType,
} from '../../services/assistantService';

const FEEDBACK_OPTIONS: Array<{ value: AssistantFeedbackType; label: string }> = [
	{ value: 'incorrect_answer', label: 'Incorrect answer' },
	{ value: 'wrong_intent', label: 'Wrong intent' },
	{ value: 'missing_details', label: 'Missing details' },
	{ value: 'wrong_calculation', label: 'Wrong calculation' },
	{ value: 'failed_action', label: 'Failed action' },
	{ value: 'irrelevant_response', label: 'Irrelevant response' },
	{ value: 'language_issue', label: 'Language issue' },
	{ value: 'correct_answer', label: 'Correct answer' },
];

type Props = {
	sessionId: string | null;
	lastUserText?: string;
	lastAssistantText?: string;
	lastIntent?: string;
	onClose: () => void;
};

export default function FeedbackPanel({ sessionId, lastUserText, lastAssistantText, lastIntent, onClose }: Props) {
	const [type, setType] = useState<AssistantFeedbackType>('incorrect_answer');
	const [correction, setCorrection] = useState('');
	const [expected, setExpected] = useState('');
	const [busy, setBusy] = useState(false);
	const [note, setNote] = useState('');
	const [summary, setSummary] = useState<AssistantFeedbackSummary | null>(null);
	const [pending, setPending] = useState<Array<{ id: string; type: string; originalRequest: string; correction: string }>>([]);

	async function refresh() {
		const data = await listAssistantFeedback();
		setSummary(data.summary);
		setPending(data.items.filter((item) => item.status === 'pending').slice(0, 8).map((item) => ({
			id: item.id,
			type: item.type,
			originalRequest: item.originalRequest,
			correction: item.correction,
		})));
	}

	useEffect(() => {
		let cancelled = false;
		listAssistantFeedback()
			.then((data) => {
				if (cancelled) return;
				setSummary(data.summary);
				setPending(data.items.filter((item) => item.status === 'pending').slice(0, 8).map((item) => ({
					id: item.id,
					type: item.type,
					originalRequest: item.originalRequest,
					correction: item.correction,
				})));
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	async function submit() {
		setBusy(true);
		setNote('');
		try {
			await submitAssistantFeedback({
				type,
				sessionId,
				originalRequest: lastUserText,
				assistantResponse: lastAssistantText,
				detectedIntent: lastIntent,
				correction,
				expectedBehaviour: expected,
			});
			setCorrection('');
			setExpected('');
			setNote('Feedback saved. Pending approval.');
			await refresh();
		} catch (error) {
			setNote(error instanceof Error ? error.message : 'Could not save feedback.');
		} finally {
			setBusy(false);
		}
	}

	async function review(id: string, status: 'approved' | 'rejected') {
		await reviewAssistantFeedback(id, { status });
		await refresh();
	}

	return (
		<Stack spacing={3} p={3} bg="white" borderRadius="12px" border="1px solid" borderColor="slate.200">
			<HStack justify="space-between">
				<Text fontWeight="700" color="slate.800">Feedback & learning</Text>
				<Button size="xs" variant="ghost" onClick={onClose}>Close</Button>
			</HStack>
			{summary ? (
				<Text fontSize="xs" color="slate.500">
					Total {summary.total} · Pending {summary.pending} · Approved {summary.approved} · Rejected {summary.rejected}
				</Text>
			) : null}
			<Select size="sm" value={type} onChange={(event) => setType(event.target.value as AssistantFeedbackType)}>
				{FEEDBACK_OPTIONS.map((option) => (
					<option key={option.value} value={option.value}>{option.label}</option>
				))}
			</Select>
			<Textarea
				size="sm"
				placeholder="What was wrong / your correction"
				value={correction}
				onChange={(event) => setCorrection(event.target.value)}
				maxLength={2000}
			/>
			<Textarea
				size="sm"
				placeholder="Expected behaviour (optional)"
				value={expected}
				onChange={(event) => setExpected(event.target.value)}
				maxLength={2000}
			/>
			<Button size="sm" colorScheme="brand" isLoading={busy} onClick={() => void submit()}>
				Submit feedback
			</Button>
			{note ? <Text fontSize="xs" color="slate.600">{note}</Text> : null}
			{pending.length > 0 ? (
				<Stack spacing={2}>
					<Text fontSize="xs" fontWeight="700" color="slate.500" textTransform="uppercase">Pending corrections</Text>
					{pending.map((item) => (
						<Stack key={item.id} spacing={1} p={2} bg="slate.50" borderRadius="8px">
							<Text fontSize="xs" color="slate.700" noOfLines={2}>{item.originalRequest || item.type}</Text>
							{item.correction ? <Text fontSize="xs" color="slate.500" noOfLines={2}>{item.correction}</Text> : null}
							<HStack>
								<Button size="xs" onClick={() => void review(item.id, 'approved')}>Approve</Button>
								<Button size="xs" variant="outline" onClick={() => void review(item.id, 'rejected')}>Reject</Button>
							</HStack>
						</Stack>
					))}
				</Stack>
			) : null}
		</Stack>
	);
}
