import { CloseIcon, DownloadIcon, RepeatIcon } from '@chakra-ui/icons';
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
	type AssistantPlan,
} from '../../services/assistantService';
import { downloadAssistantDocument, EmptyDocumentError } from './assistantDocuments';

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

const VOICE_KEY = 'shreeji-assistant-voice';

function canSpeak() {
	return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Text as it should be read aloud: no bullets, symbols or emoji, and not too long. */
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

const DocumentIcon = createIcon({
	displayName: 'DocumentIcon',
	viewBox: '0 0 24 24',
	path: <path fill="currentColor" d="M6 2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V9h5.5L13 3.5ZM8 13v2h8v-2H8Zm0 4v2h5v-2H8Z" />,
});

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

const GRADIENT = 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #DB2777 100%)';

const SUGGESTIONS = [
	'इस महीने की wages sheet PDF में',
	'सभी employees की पिछले महीने की salary slip',
	'October का payroll Excel में',
	'इस महीने की attendance किन locations पर बाकी है?',
];

// sessionStorage is cleared when the tab closes, so a new tab starts a new chat; the server deletes chats after 24 hours.
const SESSION_KEY = 'shreeji-assistant-session';

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
	document?: AssistantDocument;
	documentStatus?: DocumentStatus;
	documentFormat?: DocumentFormat;
	documentError?: string;
	choices?: AssistantChoice[];
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

function TypingDots() {
	return (
		<HStack spacing={1} px={4} py={3} bg="white" borderRadius="16px" borderBottomLeftRadius="4px" boxShadow="sm" w="fit-content">
			{[0, 1, 2].map((index) => (
				<Box key={index} w="7px" h="7px" borderRadius="full" bg="brand.400" animation={`${bounce} 1.2s ${index * 0.15}s infinite ease-in-out`} />
			))}
		</HStack>
	);
}

const FORMAT_STYLES: Record<DocumentFormat, { label: string; bg: string; color: string; hover: string }> = {
	pdf: { label: 'PDF', bg: 'red.50', color: 'red.600', hover: 'red.100' },
	excel: { label: 'Excel', bg: 'green.50', color: 'green.700', hover: 'green.100' },
};

/** Nothing downloads until the user picks a format here. */
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

function AssistantWidget() {
	const [isOpen, setIsOpen] = useState(false);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState('');
	const [isThinking, setIsThinking] = useState(false);
	const [isListening, setIsListening] = useState(false);
	const [speechLanguage, setSpeechLanguage] = useState(SPEECH_LANGUAGES[0].code);
	const [speechError, setSpeechError] = useState('');
	const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const sessionIdRef = useRef<string | null>(storedSessionId());
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
		// Some browsers load their voice list late; asking once makes it ready for the first reply.
		if (canSpeak()) window.speechSynthesis.getVoices();
		return () => {
			if (canSpeak()) window.speechSynthesis.cancel();
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
		const sessionId = sessionIdRef.current;
		sessionIdRef.current = null;
		storeSessionId(null);
		stopSpeaking();
		setMessages([]);
		setInput('');
		if (sessionId) void deleteAssistantSession(sessionId).catch(() => undefined);
	}

	useEffect(() => {
		scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
	}, [messages, isThinking]);

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

	async function ask(request: { message?: string; plan?: AssistantPlan }, userText: string) {
		if (isThinking) return;
		setMessages((current) => [...current, { id: nextId++, role: 'user', text: userText }]);
		setIsThinking(true);
		try {
			const response = await askAssistant({
				...request,
				label: userText,
				sessionId: sessionIdRef.current,
				language: speechLanguage,
			});
			sessionIdRef.current = response.sessionId;
			storeSessionId(response.sessionId);
			const id = nextId++;
			setMessages((current) => [...current, {
				id,
				role: 'assistant',
				text: response.reply,
				document: response.document,
				documentStatus: response.document ? 'ready' : undefined,
				choices: response.choices,
			}]);
			speak(response.reply);
		} catch (error) {
			const text = error instanceof ApiError ? error.message : 'Server से connect नहीं हो पाया। थोड़ी देर बाद फिर कोशिश करें।';
			setMessages((current) => [...current, { id: nextId++, role: 'assistant', text }]);
			speak(text);
		} finally {
			setIsThinking(false);
		}
	}

	function send(text: string) {
		const message = text.trim();
		if (!message) return;
		setInput('');
		void ask({ message }, message);
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
			<ScaleFade in={isOpen} initialScale={0.9} unmountOnExit>
				<Flex
					position="fixed"
					zIndex={1400}
					bottom={{ base: 0, sm: '96px' }}
					right={{ base: 0, sm: 6 }}
					w={{ base: '100vw', sm: '400px' }}
					h={{ base: '100dvh', sm: 'min(600px, calc(100vh - 130px))' }}
					direction="column"
					bg="slate.50"
					borderRadius={{ base: 0, sm: '20px' }}
					boxShadow="0 24px 64px -12px rgba(30, 27, 75, .35)"
					overflow="hidden"
					border="1px solid"
					borderColor="whiteAlpha.600"
				>
					<HStack px={4} py={3.5} bgImage={GRADIENT} color="white" spacing={3}>
						<Flex w="40px" h="40px" borderRadius="full" bg="whiteAlpha.300" align="center" justify="center">
							<FlowerIcon boxSize={6} />
						</Flex>
						<Box flex="1" minW={0}>
							<Text fontWeight="800" fontSize="md" lineHeight="short">Shreeji Assistant</Text>
							{isSpeaking && <Text fontSize="xs" opacity={0.85}>बोल रही हूँ…</Text>}
						</Box>
						{canSpeak() && (
							<Tooltip label={voiceOn ? 'आवाज़ बंद करें' : 'जवाब बोलकर सुनाएँ'} hasArrow>
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
							<Tooltip label="नई chat शुरू करें (पुरानी chat मिट जाएगी)" hasArrow>
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
						{messages.length === 0 ? (
							<Box>
								<Box p={4} bg="white" borderRadius="16px" boxShadow="sm">
									<Text fontWeight="700" color="slate.800">नमस्ते! 😊</Text>
									<Text mt={1} fontSize="sm" color="slate.600">मैं श्रीजी हूँ, Shreeji Caretaker की AI Assistant।</Text>
								</Box>
								<Text mt={4} mb={2} fontSize="xs" fontWeight="700" color="slate.500" textTransform="uppercase" letterSpacing="wide">
									Try asking
								</Text>
								<Wrap spacing={2}>
									{SUGGESTIONS.map((suggestion) => (
										<WrapItem key={suggestion}>
											<Button
												size="sm"
												variant="outline"
												bg="white"
												borderColor="brand.100"
												color="brand.600"
												fontWeight="600"
												borderRadius="full"
												whiteSpace="normal"
												textAlign="left"
												h="auto"
												py={1.5}
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
								<Box maxW="88%">
									<Box
										px={3.5}
										py={2.5}
										fontSize="sm"
										whiteSpace="pre-wrap"
										borderRadius="16px"
										{...(message.role === 'user'
											? { bgImage: GRADIENT, color: 'white', borderBottomRightRadius: '4px' }
											: { bg: 'white', color: 'slate.800', borderBottomLeftRadius: '4px', boxShadow: 'sm' })}
									>
										{message.text}
									</Box>
									{message.document ? (
										<DocumentCard message={message} onDownload={(format) => void runDocument(message.id, message.document!, format)} />
									) : null}
									{message.choices?.length ? (
										<Stack mt={2} spacing={1.5}>
											{message.choices.map((choice) => (
												<Button
													key={`${choice.plan.locationId}-${choice.plan.employeeId}-${choice.label}`}
													size="sm"
													variant="outline"
													bg="white"
													justifyContent="flex-start"
													whiteSpace="normal"
													textAlign="left"
													h="auto"
													py={2}
													fontWeight="600"
													color="slate.700"
													borderColor="slate.200"
													_hover={{ borderColor: 'brand.300', color: 'brand.600', bg: 'brand.50' }}
													isDisabled={isThinking}
													onClick={() => pickChoice(message.id, choice)}
												>
													{choice.label}
												</Button>
											))}
										</Stack>
									) : null}
								</Box>
							</Flex>
						))}
						{isThinking ? <TypingDots /> : null}
					</Stack>

					<Box as="form" onSubmit={onSubmit} px={3} pt={2} pb={3} bg="white" borderTop="1px solid" borderColor="slate.100">
						{isListening || speechError ? (
							<Text px={1} pb={1.5} fontSize="xs" fontWeight="600" color={speechError ? 'red.500' : 'red.400'}>
								{speechError || 'सुन रही हूँ… बोलिए'}
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
									<Tooltip label={isListening ? 'Stop' : 'बोलकर पूछें'} hasArrow>
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
								placeholder={isListening ? 'सुन रही हूँ…' : 'जैसे: Horticulture की इस महीने की wages sheet'}
								maxLength={500}
								borderRadius="full"
								bg="slate.50"
								borderColor="slate.200"
								fontSize="sm"
								_focus={{ borderColor: 'brand.400', boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)', bg: 'white' }}
							/>
							<IconButton
								type="submit"
								aria-label="Send"
								icon={<SendIcon boxSize={4} />}
								borderRadius="full"
								bgImage={GRADIENT}
								color="white"
								_hover={{ opacity: 0.9 }}
								_active={{ opacity: 0.8 }}
								isDisabled={!input.trim() || isThinking}
							/>
						</HStack>
					</Box>
				</Flex>
			</ScaleFade>

			<Box position="fixed" zIndex={1400} bottom={6} right={6} display={{ base: isOpen ? 'none' : 'block', sm: 'block' }}>
				{!isOpen ? (
					<Box position="absolute" inset={0} borderRadius="full" bgImage={GRADIENT} animation={`${pulse} 2.2s infinite ease-out`} pointerEvents="none" />
				) : null}
				<Tooltip label={isOpen ? 'Close assistant' : 'Shreeji Assistant'} placement="left" hasArrow>
					<IconButton
						aria-label={isOpen ? 'Close assistant' : 'Open assistant'}
						icon={isOpen ? <CloseIcon boxSize={4} /> : <FlowerIcon boxSize={8} />}
						position="relative"
						w="60px"
						h="60px"
						borderRadius="full"
						bgImage={GRADIENT}
						color="white"
						boxShadow="0 12px 28px -6px rgba(124, 58, 237, .6)"
						transition="transform .2s ease"
						_hover={{ transform: 'scale(1.07) rotate(-8deg)' }}
						_active={{ transform: 'scale(.96)' }}
						onClick={() => setIsOpen((open) => !open)}
					/>
				</Tooltip>
			</Box>
		</>
	);
}

export default AssistantWidget;
