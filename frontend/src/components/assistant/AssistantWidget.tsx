import { CloseIcon, CopyIcon, DownloadIcon, RepeatIcon } from '@chakra-ui/icons';
import {
	Box,
	Button,
	createIcon,
	Flex,
	HStack,
	IconButton,
	Input,
	ScaleFade,
	Spinner,
	Stack,
	Text,
	Tooltip,
	Wrap,
	WrapItem,
} from '@chakra-ui/react';
import { keyframes } from '@emotion/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../../services/api';
import {
	askAssistant,
	deleteAssistantSession,
	getAssistantSession,
	type AssistantChoice,
	type AssistantDocument,
	type AssistantExecution,
	type AssistantPendingAction,
	type AssistantPlan,
} from '../../services/assistantService';
import { downloadAssistantDocument, EmptyDocumentError } from './assistantDocuments';
import FeedbackPanel from './FeedbackPanel';

const FlowerIcon = createIcon({
	displayName: 'FlowerIcon',
	viewBox: '0 0 24 24',
	path: (
		<g fill="currentColor">
			<path d="M12 2.5c1.9 0 3.2 1.7 3.2 3.6 0 .9-.3 1.8-.8 2.5.8-.3 1.6-.4 2.5-.2 1.9.4 3.2 2.2 2.8 4.1-.4 1.9-2.3 2.9-4.2 2.5-.9-.2-1.6-.6-2.2-1.2.2.8.2 1.7-.2 2.5-.8 1.7-2.9 2.4-4.6 1.6-1.7-.8-2.3-2.9-1.5-4.6.4-.8 1-1.4 1.8-1.7-.8-.1-1.6-.5-2.2-1.1-1.4-1.4-1.3-3.6.1-4.9 1.4-1.3 3.5-1.2 4.8.2.2-1.9 1.2-3.3 2.5-3.3Z" opacity=".35" />
			<circle cx="12" cy="11" r="2.6" />
			<path d="M11.25 15.5h1.5v6h-1.5z" />
			<path d="M12 20c-1.6-2.4-3.8-3-5.5-2.6 1 1.9 3 3 5.5 2.6Zm0 0c1.6-2.4 3.8-3 5.5-2.6-1 1.9-3 3-5.5 2.6Z" />
		</g>
	),
});

const MicIcon = createIcon({
	displayName: 'MicIcon',
	viewBox: '0 0 24 24',
	path: (
		<path
			fill="currentColor"
			d="M12 14a3 3 0 0 0 3-3V5a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z"
		/>
	),
});

const SendIcon = createIcon({
	displayName: 'SendIcon',
	viewBox: '0 0 24 24',
	path: <path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z" />,
});

const SpeakerIcon = createIcon({
	displayName: 'SpeakerIcon',
	viewBox: '0 0 24 24',
	path: <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05A4.48 4.48 0 0 0 16.5 12ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06A9 9 0 0 0 14 3.23Z" />,
});

const SpeakerOffIcon = createIcon({
	displayName: 'SpeakerOffIcon',
	viewBox: '0 0 24 24',
	path: <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm18.7 1.1-1.4-1.4L18 11l-2.3-2.3-1.4 1.4 2.3 2.3-2.3 2.3 1.4 1.4L18 13.8l2.3 2.3 1.4-1.4-2.3-2.3 2.3-2.3Z" />,
});

const DocumentIcon = createIcon({
	displayName: 'DocumentIcon',
	viewBox: '0 0 24 24',
	path: <path fill="currentColor" d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V9h5.5L13 3.5ZM8 13v2h8v-2H8Zm0 4v2h5v-2H8Z" />,
});

const VOICE_KEY = 'shreeji-assistant-voice';
const SESSION_KEY = 'shreeji-assistant-session';

function canSpeak() {
	return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function spokenText(text: string) {
	const clean = text
		.replace(/₹\s?/g, '₹ ')
		.replace(/[•✅✓😊]/gu, ' ')
		.replace(/\p{Extended_Pictographic}/gu, ' ')
		.replace(/\s*[·—–]\s*/g, ', ')
		.replace(/\s+/g, ' ')
		.trim();
	return clean.length > 500 ? `${clean.slice(0, 500)}…` : clean;
}

function pickVoice(language: string) {
	const voices = window.speechSynthesis.getVoices();
	const base = language.split('-')[0];
	return voices.find((voice) => voice.lang === language)
		?? voices.find((voice) => voice.lang.startsWith(base))
		?? voices.find((voice) => voice.lang.endsWith('-IN'))
		?? null;
}

const pulse = keyframes`
	0% { transform: scale(1); opacity: .55; }
	100% { transform: scale(1.75); opacity: 0; }
`;

const listening = keyframes`
	0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, .45); }
	50% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
`;

const bounce = keyframes`
	0%, 80%, 100% { transform: translateY(0); opacity: .4; }
	40% { transform: translateY(-4px); opacity: 1; }
`;

const PANEL_HEADER = 'linear-gradient(135deg, #4338CA 0%, #4F46E5 100%)';

const SUGGESTIONS = [
	'Show all active employees',
	"Give me today's attendance summary",
	"Show this month's payroll details",
	'Generate the attendance register',
	'Show all organization details',
];

function storedSessionId() {
	try {
		return window.sessionStorage.getItem(SESSION_KEY);
	} catch {
		return null;
	}
}

function storeSessionId(id: string | null) {
	try {
		if (id) window.sessionStorage.setItem(SESSION_KEY, id);
		else window.sessionStorage.removeItem(SESSION_KEY);
	} catch {
		// Private mode without storage: the chat still works for this page.
	}
}

type DocumentStatus = 'ready' | 'working' | 'done' | 'empty' | 'error';
type DocumentFormat = AssistantDocument['format'];

type ChatMessage = {
	id: number;
	role: 'user' | 'assistant';
	text: string;
	at: number;
	document?: AssistantDocument;
	documentStatus?: DocumentStatus;
	documentFormat?: DocumentFormat;
	documentError?: string;
	choices?: AssistantChoice[];
	pendingAction?: AssistantPendingAction | null;
	execution?: AssistantExecution;
	intent?: string;
	error?: boolean;
};

type SpeechRecognitionResultEvent = {
	resultIndex: number;
	results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
};

type SpeechRecognitionInstance = {
	lang: string;
	interimResults: boolean;
	continuous: boolean;
	start: () => void;
	stop: () => void;
	abort: () => void;
	onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
	onerror: ((event: { error: string }) => void) | null;
	onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function speechRecognition(): SpeechRecognitionConstructor | null {
	const scope = window as unknown as { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };
	return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

const SPEECH_LANGUAGES = [
	{ code: 'hi-IN', label: 'हिं' },
	{ code: 'en-IN', label: 'EN' },
];

let nextId = 1;

function formatTime(at: number) {
	try {
		return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	} catch {
		return '';
	}
}

function stageLabel(execution?: AssistantExecution, thinking?: boolean) {
	if (!thinking && !execution?.status) return '';
	const status = execution?.status || 'understanding';
	const map: Record<string, string> = {
		understanding: 'Understanding request…',
		fetching: 'Fetching information…',
		validating: 'Validating parameters…',
		preview: 'Preparing preview…',
		awaiting_confirmation: 'Waiting for confirmation…',
		needs_clarification: 'Needs clarification',
		completed: 'Completed',
		failed: 'Failed',
		cancelled: 'Cancelled',
		unsupported: 'Unsupported',
		already_executed: 'Already completed',
	};
	return map[status] || (thinking ? 'Working…' : status);
}

function TypingDots({ label }: { label?: string }) {
	return (
		<Stack spacing={1}>
			{label ? <Text fontSize="xs" color="slate.500" fontWeight="600">{label}</Text> : null}
			<HStack spacing={1} px={4} py={3} bg="white" borderRadius="16px" borderBottomLeftRadius="4px" boxShadow="sm" w="fit-content">
				{[0, 1, 2].map((index) => (
					<Box key={index} w="7px" h="7px" borderRadius="full" bg="brand.400" animation={`${bounce} 1.2s ${index * 0.15}s infinite ease-in-out`} />
				))}
			</HStack>
		</Stack>
	);
}

const FORMAT_STYLES: Record<DocumentFormat, { label: string; bg: string; color: string; hover: string }> = {
	pdf: { label: 'PDF', bg: 'red.50', color: 'red.600', hover: 'red.100' },
	excel: { label: 'Excel', bg: 'green.50', color: 'green.700', hover: 'green.100' },
};

function DocumentCard({ message, onDownload }: { message: ChatMessage; onDownload: (format: DocumentFormat) => void }) {
	const document = message.document!;
	const status = message.documentStatus ?? 'ready';
	const lastFormat = message.documentFormat ?? document.format;
	const isWorking = status === 'working';
	const statusText = isWorking
		? `${FORMAT_STYLES[lastFormat].label} बन रहा है…`
		: status === 'done'
			? `${FORMAT_STYLES[lastFormat].label} downloaded ✓`
			: status === 'ready'
				? 'Download के लिए format चुनें'
				: message.documentError;
	return (
		<Box mt={2} p={3} bg="white" border="1px solid" borderColor={status === 'error' ? 'red.200' : 'slate.200'} borderRadius="12px">
			<HStack spacing={3} align="flex-start">
				<Flex flexShrink={0} w="38px" h="38px" borderRadius="10px" align="center" justify="center" bg="brand.50" color="brand.600">
					<DocumentIcon boxSize={5} />
				</Flex>
				<Box flex="1" minW={0}>
					<Text fontSize="sm" fontWeight="700" color="slate.800" lineHeight="short">{document.title}</Text>
					<HStack mt={1} spacing={1.5} fontSize="xs">
						{isWorking ? <Spinner size="xs" color="brand.500" /> : null}
						<Text color={status === 'error' || status === 'empty' ? 'red.500' : status === 'done' ? 'green.600' : 'slate.500'}>{statusText}</Text>
					</HStack>
				</Box>
			</HStack>
			<HStack mt={2.5} spacing={2}>
				{(['pdf', 'excel'] as const).map((format) => {
					const style = FORMAT_STYLES[format];
					const isSuggested = format === document.format;
					return (
						<Button
							key={format}
							flex="1"
							size="sm"
							leftIcon={status === 'error' && format === lastFormat ? <RepeatIcon /> : <DownloadIcon />}
							bg={style.bg}
							color={style.color}
							border="1px solid"
							borderColor={isSuggested ? style.color : 'transparent'}
							_hover={{ bg: style.hover }}
							fontWeight="700"
							isLoading={isWorking && format === lastFormat}
							isDisabled={isWorking}
							onClick={() => onDownload(format)}
						>
							{style.label}
						</Button>
					);
				})}
			</HStack>
		</Box>
	);
}

function ConfirmationCard({
	message,
	disabled,
	onPick,
}: {
	message: ChatMessage;
	disabled: boolean;
	onPick: (choice: AssistantChoice) => void;
}) {
	const confirmChoices = (message.choices || []).filter((choice) => choice.plan.confirm === true || choice.plan.type === 'cancel' || choice.plan.pendingActionId);
	const otherChoices = (message.choices || []).filter((choice) => !confirmChoices.includes(choice));
	const isConfirmFlow = Boolean(message.pendingAction) || confirmChoices.some((choice) => choice.plan.confirm === true);

	return (
		<Stack mt={2} spacing={1.5}>
			{isConfirmFlow ? (
				<Box p={3} bg="orange.50" border="1px solid" borderColor="orange.200" borderRadius="12px">
					<Text fontSize="xs" fontWeight="700" color="orange.700" mb={1}>Confirmation required</Text>
					{message.pendingAction?.summary ? (
						<Text fontSize="xs" color="slate.600" mb={2} noOfLines={4}>{message.pendingAction.summary}</Text>
					) : null}
					<Text fontSize="xs" color="slate.500">Database will change only after you confirm.</Text>
				</Box>
			) : null}
			{[...otherChoices, ...confirmChoices].map((choice, index) => {
				const isConfirm = choice.plan.confirm === true;
				const isCancel = choice.plan.type === 'cancel';
				return (
					<Button
						key={`${choice.label}-${index}-${choice.plan.pendingActionId || ''}`}
						size="sm"
						variant={isConfirm ? 'solid' : 'outline'}
						colorScheme={isConfirm ? 'brand' : isCancel ? 'gray' : undefined}
						bg={isConfirm ? undefined : 'white'}
						justifyContent="flex-start"
						whiteSpace="normal"
						textAlign="left"
						h="auto"
						py={2}
						fontWeight="600"
						color={isConfirm ? undefined : 'slate.700'}
						borderColor={isConfirm ? undefined : 'slate.200'}
						_hover={isConfirm ? undefined : { borderColor: 'brand.300', color: 'brand.600', bg: 'brand.50' }}
						isDisabled={disabled}
						onClick={() => onPick(choice)}
					>
						{choice.label}
					</Button>
				);
			})}
		</Stack>
	);
}

function AssistantWidget() {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [isThinking, setIsThinking] = useState(false);
	const [thinkStage, setThinkStage] = useState('Understanding request…');
	const [isListening, setIsListening] = useState(false);
	const [speechLanguage, setSpeechLanguage] = useState(SPEECH_LANGUAGES[0].code);
	const [speechError, setSpeechError] = useState('');
	const [showFeedback, setShowFeedback] = useState(false);
	const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const sessionIdRef = useRef<string | null>(storedSessionId());
	const [sessionId, setSessionId] = useState<string | null>(storedSessionId());
	const abortRef = useRef<AbortController | null>(null);
	const [lastUserText, setLastUserText] = useState('');
	const [lastAssistantText, setLastAssistantText] = useState('');
	const [lastIntent, setLastIntent] = useState('');
	const canListen = Boolean(speechRecognition());
	const [voiceOn, setVoiceOn] = useState(() => {
		try {
			return window.localStorage.getItem(VOICE_KEY) !== 'off';
		} catch {
			return true;
		}
	});
	const [isSpeaking, setIsSpeaking] = useState(false);

	function stopSpeaking() {
		if (!canSpeak()) return;
		window.speechSynthesis.cancel();
		setIsSpeaking(false);
	}

	function speak(text: string) {
		if (!voiceOn || !canSpeak()) return;
		const words = spokenText(text);
		if (!words) return;
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(words);
		utterance.lang = speechLanguage;
		const voice = pickVoice(speechLanguage);
		if (voice) utterance.voice = voice;
		utterance.rate = 1;
		utterance.onstart = () => setIsSpeaking(true);
		utterance.onend = () => setIsSpeaking(false);
		utterance.onerror = () => setIsSpeaking(false);
		window.speechSynthesis.speak(utterance);
	}

	function toggleVoice() {
		const next = !voiceOn;
		setVoiceOn(next);
		if (!next) stopSpeaking();
		try {
			window.localStorage.setItem(VOICE_KEY, next ? 'on' : 'off');
		} catch {
			// Storage blocked: the choice lasts for this page only.
		}
	}

	useEffect(() => {
		if (canSpeak()) window.speechSynthesis.getVoices();
		return () => {
			if (canSpeak()) window.speechSynthesis.cancel();
			abortRef.current?.abort();
		};
	}, []);

	useEffect(() => {
		const sessionId = sessionIdRef.current;
		if (!sessionId) return;
		let cancelled = false;
		getAssistantSession(sessionId)
			.then((session) => {
				if (cancelled) return;
				setMessages(session.messages.map((message) => ({
					id: nextId++,
					role: message.role,
					text: message.content,
					at: Date.now(),
					document: message.document,
					documentStatus: message.document ? 'ready' : undefined,
				})));
			})
			.catch(() => {
				if (cancelled) return;
				sessionIdRef.current = null;
				storeSessionId(null);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	function newChat() {
		abortRef.current?.abort();
		const previous = sessionIdRef.current;
		sessionIdRef.current = null;
		setSessionId(null);
		storeSessionId(null);
		stopSpeaking();
		setMessages([]);
		setInput('');
		setShowFeedback(false);
		setIsThinking(false);
		if (previous) void deleteAssistantSession(previous).catch(() => undefined);
	}

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [messages, isThinking, showFeedback]);

	useEffect(() => {
		if (isOpen) window.setTimeout(() => inputRef.current?.focus(), 150);
		else {
			recognitionRef.current?.abort();
			if (canSpeak()) window.speechSynthesis.cancel();
		}
	}, [isOpen]);

	useEffect(() => () => recognitionRef.current?.abort(), []);

	function updateMessage(id: number, patch: Partial<ChatMessage>) {
		setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch } : message)));
	}

	async function runDocument(id: number, document: AssistantDocument, format: DocumentFormat) {
		updateMessage(id, { documentStatus: 'working', documentFormat: format, documentError: '' });
		try {
			await downloadAssistantDocument({ ...document, format });
			updateMessage(id, { documentStatus: 'done' });
		} catch (error) {
			const empty = error instanceof EmptyDocumentError;
			updateMessage(id, {
				documentStatus: empty ? 'empty' : 'error',
				documentError: error instanceof Error && (empty || error instanceof ApiError) ? error.message : 'Document नहीं बन पाया।',
			});
		}
	}

	async function copyText(text: string) {
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			// Clipboard may be blocked.
		}
	}

	async function ask(request: { message?: string; plan?: AssistantPlan }, userText: string) {
		if (isThinking) return;
		setLastUserText(userText);
		setMessages((current) => [...current, { id: nextId++, role: 'user', text: userText, at: Date.now() }]);
		setIsThinking(true);
		setThinkStage(request.plan?.confirm ? 'Executing operation…' : 'Understanding request…');
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		try {
			if (!request.plan) {
				window.setTimeout(() => {
					if (!controller.signal.aborted) setThinkStage('Fetching information…');
				}, 400);
			}
			const response = await askAssistant({
				...request,
				label: userText,
				sessionId: sessionIdRef.current,
				language: speechLanguage,
			}, controller.signal);
			sessionIdRef.current = response.sessionId;
			setSessionId(response.sessionId);
			storeSessionId(response.sessionId);
			setLastAssistantText(response.reply);
			setLastIntent(response.intent || response.source || '');
			const id = nextId++;
			setMessages((current) => [...current, {
				id,
				role: 'assistant',
				text: response.reply,
				at: Date.now(),
				document: response.document,
				documentStatus: response.document ? 'ready' : undefined,
				choices: response.choices,
				pendingAction: response.pendingAction,
				execution: response.execution,
				intent: response.intent,
				error: response.success === false,
			}]);
			speak(response.reply);
		} catch (error) {
			if (controller.signal.aborted) return;
			const text = error instanceof ApiError ? error.message : 'Server से connect नहीं हो पाया। थोड़ी देर बाद फिर कोशिश करें।';
			setMessages((current) => [...current, { id: nextId++, role: 'assistant', text, at: Date.now(), error: true }]);
			speak(text);
		} finally {
			if (!controller.signal.aborted) setIsThinking(false);
		}
	}

	function send(text: string) {
		const message = text.trim();
		if (!message) return;
		setInput('');
		void ask({ message }, message);
	}

	function stopGeneration() {
		abortRef.current?.abort();
		setIsThinking(false);
		setThinkStage('');
	}

	const sendRef = useRef(send);
	useEffect(() => {
		sendRef.current = send;
	});

	function onSubmit(event: FormEvent) {
		event.preventDefault();
		send(input);
	}

	function pickChoice(messageId: number, choice: AssistantChoice) {
		updateMessage(messageId, { choices: undefined });
		void ask({ plan: choice.plan }, choice.label);
	}

	function retryLast() {
		const lastUser = [...messages].reverse().find((message) => message.role === 'user');
		if (!lastUser || isThinking) return;
		void ask({ message: lastUser.text }, lastUser.text);
	}

	function toggleListening() {
		if (isListening) {
			recognitionRef.current?.stop();
			return;
		}
		const Recognition = speechRecognition();
		if (!Recognition) return;
		stopSpeaking();
		setSpeechError('');
		const recognition = new Recognition();
		recognition.lang = speechLanguage;
		recognition.interimResults = true;
		recognition.continuous = false;
		let transcript = '';
		recognition.onresult = (event) => {
			let interim = '';
			for (let index = event.resultIndex; index < event.results.length; index += 1) {
				const result = event.results[index];
				if (result.isFinal) transcript += result[0].transcript;
				else interim += result[0].transcript;
			}
			setInput(`${transcript}${interim}`);
		};
		recognition.onerror = (event) => {
			if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setSpeechError('Microphone की permission दें।');
			else if (event.error === 'no-speech') setSpeechError('कुछ सुनाई नहीं दिया, फिर से बोलें।');
			else if (event.error !== 'aborted') setSpeechError('आवाज़ पहचान नहीं हो पाई।');
		};
		recognition.onend = () => {
			setIsListening(false);
			recognitionRef.current = null;
			if (transcript.trim()) sendRef.current(transcript);
		};
		recognitionRef.current = recognition;
		setIsListening(true);
		recognition.start();
	}

	return (
		<>
			<ScaleFade in={isOpen} initialScale={0.95} unmountOnExit>
				<Flex
					position="fixed"
					zIndex={1400}
					bottom={{ base: 0, sm: '96px' }}
					right={{ base: 0, sm: 6 }}
					w={{ base: '100vw', sm: '420px' }}
					h={{ base: '100dvh', sm: 'min(680px, calc(100vh - 120px))' }}
					direction="column"
					bg="slate.50"
					borderRadius={{ base: 0, sm: '18px' }}
					boxShadow="0 24px 64px -12px rgba(15, 23, 42, .28)"
					overflow="hidden"
					border="1px solid"
					borderColor="slate.200"
				>
					<HStack px={4} py={3.5} bgImage={PANEL_HEADER} color="white" spacing={3}>
						<Flex w="40px" h="40px" borderRadius="full" bg="whiteAlpha.300" align="center" justify="center">
							<FlowerIcon boxSize={6} />
						</Flex>
						<Box flex="1" minW={0}>
							<Text fontWeight="800" fontSize="md" lineHeight="short">Shreeji AI</Text>
							<Text fontSize="xs" opacity={0.9}>
								{isSpeaking ? 'Speaking…' : isThinking ? stageLabel(undefined, true) || thinkStage : 'Admin Assistant'}
							</Text>
						</Box>
						<Tooltip label="Feedback" hasArrow>
							<IconButton
								aria-label="Open feedback"
								icon={<Text fontSize="sm" fontWeight="800">!</Text>}
								size="sm"
								variant="ghost"
								color="white"
								_hover={{ bg: 'whiteAlpha.300' }}
								onClick={() => setShowFeedback((value) => !value)}
							/>
						</Tooltip>
						{canSpeak() && (
							<Tooltip label={voiceOn ? 'Mute voice' : 'Speak replies'} hasArrow>
								<IconButton
									aria-label={voiceOn ? 'Turn voice off' : 'Turn voice on'}
									aria-pressed={voiceOn}
									icon={voiceOn ? <SpeakerIcon boxSize={4} /> : <SpeakerOffIcon boxSize={4} />}
									size="sm"
									variant="ghost"
									color="white"
									_hover={{ bg: 'whiteAlpha.300' }}
									onClick={toggleVoice}
								/>
							</Tooltip>
						)}
						{messages.length > 0 && (
							<Tooltip label="New chat" hasArrow>
								<IconButton
									aria-label="New chat"
									icon={<RepeatIcon boxSize={3.5} />}
									size="sm"
									variant="ghost"
									color="white"
									_hover={{ bg: 'whiteAlpha.300' }}
									isDisabled={isThinking}
									onClick={newChat}
								/>
							</Tooltip>
						)}
						<IconButton
							aria-label="Close assistant"
							icon={<CloseIcon boxSize={3} />}
							size="sm"
							variant="ghost"
							color="white"
							_hover={{ bg: 'whiteAlpha.300' }}
							onClick={() => setIsOpen(false)}
						/>
					</HStack>

					<Stack ref={scrollRef} flex="1" overflowY="auto" spacing={3} px={4} py={4}>
						{showFeedback ? (
							<FeedbackPanel
								sessionId={sessionId}
								lastUserText={lastUserText}
								lastAssistantText={lastAssistantText}
								lastIntent={lastIntent}
								onClose={() => setShowFeedback(false)}
							/>
						) : null}

						{messages.length === 0 && !showFeedback ? (
							<Box>
								<Box
									p={5}
									bg="white"
									borderRadius="16px"
									boxShadow="sm"
									border="1px solid"
									borderColor="slate.100"
									backgroundImage="radial-gradient(circle at top right, rgba(79,70,229,.08), transparent 55%)"
								>
									<Text fontWeight="800" fontSize="lg" color="slate.900">Hello! I'm Shreeji AI.</Text>
									<Text mt={1.5} fontSize="sm" color="slate.600">
										Your personal Admin Assistant for Shreeji Workflow.
									</Text>
								</Box>
								<Text mt={4} mb={2} fontSize="xs" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="wide">
									Suggested prompts
								</Text>
								<Wrap spacing={2}>
									{SUGGESTIONS.map((suggestion) => (
										<WrapItem key={suggestion}>
											<Button
												size="sm"
												variant="outline"
												bg="white"
												borderColor="brand.100"
												color="brand.700"
												fontWeight="600"
												borderRadius="12px"
												whiteSpace="normal"
												textAlign="left"
												h="auto"
												py={2}
												_hover={{ bg: 'brand.50' }}
												onClick={() => send(suggestion)}
											>
												{suggestion}
											</Button>
										</WrapItem>
									))}
								</Wrap>
							</Box>
						) : null}

						{messages.map((message) => (
							<Flex key={message.id} justify={message.role === 'user' ? 'flex-end' : 'flex-start'}>
								<Box maxW="92%">
									<Box
										px={3.5}
										py={2.5}
										fontSize="sm"
										whiteSpace="pre-wrap"
										borderRadius="16px"
										border={message.error ? '1px solid' : undefined}
										borderColor={message.error ? 'red.200' : undefined}
										{...(message.role === 'user'
											? { bg: 'brand.600', color: 'white', borderBottomRightRadius: '4px' }
											: { bg: message.error ? 'red.50' : 'white', color: 'slate.800', borderBottomLeftRadius: '4px', boxShadow: 'sm' })}
									>
										{message.text}
									</Box>
									<HStack mt={1} spacing={2} justify={message.role === 'user' ? 'flex-end' : 'flex-start'}>
										<Text fontSize="10px" color="slate.400">{formatTime(message.at)}</Text>
										{message.role === 'assistant' ? (
											<>
												<Tooltip label="Copy">
													<IconButton
														aria-label="Copy response"
														icon={<CopyIcon boxSize={3} />}
														size="xs"
														variant="ghost"
														onClick={() => void copyText(message.text)}
													/>
												</Tooltip>
												{message.error ? (
													<Tooltip label="Retry">
														<IconButton
															aria-label="Retry"
															icon={<RepeatIcon boxSize={3} />}
															size="xs"
															variant="ghost"
															onClick={retryLast}
														/>
													</Tooltip>
												) : null}
												{message.execution?.status ? (
													<Text fontSize="10px" color="slate.400">{stageLabel(message.execution)}</Text>
												) : null}
											</>
										) : null}
									</HStack>
									{message.document ? (
										<DocumentCard message={message} onDownload={(format) => void runDocument(message.id, message.document!, format)} />
									) : null}
									{message.choices?.length ? (
										<ConfirmationCard message={message} disabled={isThinking} onPick={(choice) => pickChoice(message.id, choice)} />
									) : null}
								</Box>
							</Flex>
						))}
						{isThinking ? <TypingDots label={thinkStage} /> : null}
					</Stack>

					<Box as="form" onSubmit={onSubmit} px={3} pt={2} pb={3} bg="white" borderTop="1px solid" borderColor="slate.100">
						{isListening || speechError ? (
							<Text px={1} pb={1.5} fontSize="xs" fontWeight="600" color={speechError ? 'red.500' : 'red.400'}>
								{speechError || 'Listening…'}
							</Text>
						) : null}
						<HStack spacing={2}>
							{canListen ? (
								<HStack spacing={0} bg="slate.50" borderRadius="full" border="1px solid" borderColor="slate.200" p={0.5}>
									<Tooltip label="Speech language" hasArrow>
										<Button
											size="xs"
											variant="ghost"
											borderRadius="full"
											fontWeight="700"
											color="slate.600"
											minW="34px"
											onClick={() => setSpeechLanguage((current) => SPEECH_LANGUAGES[(SPEECH_LANGUAGES.findIndex(({ code }) => code === current) + 1) % SPEECH_LANGUAGES.length].code)}
											isDisabled={isListening}
										>
											{SPEECH_LANGUAGES.find(({ code }) => code === speechLanguage)?.label}
										</Button>
									</Tooltip>
									<Tooltip label={isListening ? 'Stop' : 'Voice input'} hasArrow>
										<IconButton
											aria-label={isListening ? 'Stop listening' : 'Speak your request'}
											icon={<MicIcon boxSize={5} />}
											size="sm"
											borderRadius="full"
											bg={isListening ? 'red.500' : 'transparent'}
											color={isListening ? 'white' : 'brand.600'}
											_hover={{ bg: isListening ? 'red.600' : 'brand.50' }}
											animation={isListening ? `${listening} 1.4s infinite` : undefined}
											onClick={toggleListening}
											isDisabled={isThinking}
										/>
									</Tooltip>
								</HStack>
							) : null}
							<Input
								ref={inputRef}
								value={input}
								onChange={(event) => setInput(event.target.value)}
								placeholder={isListening ? 'Listening…' : 'Ask Shreeji AI…'}
								maxLength={500}
								borderRadius="full"
								bg="slate.50"
								borderColor="slate.200"
								fontSize="sm"
								_focus={{ borderColor: 'brand.400', boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)', bg: 'white' }}
							/>
							{isThinking ? (
								<IconButton
									aria-label="Stop generation"
									icon={<CloseIcon boxSize={3} />}
									borderRadius="full"
									variant="outline"
									onClick={stopGeneration}
								/>
							) : (
								<IconButton
									type="submit"
									aria-label="Send"
									icon={<SendIcon boxSize={4} />}
									borderRadius="full"
									colorScheme="brand"
									isDisabled={!input.trim()}
								/>
							)}
						</HStack>
					</Box>
				</Flex>
			</ScaleFade>

			<Box position="fixed" zIndex={1400} bottom={6} right={6} display={{ base: isOpen ? 'none' : 'block', sm: 'block' }}>
				{!isOpen ? (
					<Box position="absolute" inset={0} borderRadius="full" bg="brand.500" animation={`${pulse} 2.2s infinite ease-out`} pointerEvents="none" />
				) : null}
				<Tooltip label={isOpen ? 'Close Shreeji AI' : 'Shreeji AI'} placement="left" hasArrow>
					<IconButton
						aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
						icon={isOpen ? <CloseIcon boxSize={4} /> : <FlowerIcon boxSize={8} />}
						position="relative"
						w="60px"
						h="60px"
						borderRadius="full"
						colorScheme="brand"
						boxShadow="0 12px 28px -6px rgba(67, 56, 202, .45)"
						transition="transform .2s ease"
						_hover={{ transform: 'scale(1.06)' }}
						_active={{ transform: 'scale(.96)' }}
						onClick={() => setIsOpen((open) => !open)}
					/>
				</Tooltip>
			</Box>
		</>
	);
}

export default AssistantWidget;
