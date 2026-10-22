import { useToast } from '@chakra-ui/react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../../../services/api';
import {
	DOCUMENT_DEFAULTS,
	getDocumentSettings,
	updateDocumentSettings,
	type DocumentSettingsMap,
	type DocumentType,
} from '../../../services/settingsService';

function pick<T extends DocumentType>(type: T, source: Partial<DocumentSettingsMap[T]>) {
	const defaults = DOCUMENT_DEFAULTS[type];
	return Object.fromEntries(
		Object.keys(defaults).map((key) => [key, String(source[key as keyof DocumentSettingsMap[T]] ?? '')]),
	) as DocumentSettingsMap[T];
}

function useDocumentSettings<T extends DocumentType>(type: T, savedMessage: string) {
	const toast = useToast();
	const [values, setValues] = useState<DocumentSettingsMap[T]>(DOCUMENT_DEFAULTS[type]);
	const [saved, setSaved] = useState<DocumentSettingsMap[T]>(DOCUMENT_DEFAULTS[type]);
	const [updatedAt, setUpdatedAt] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [loadError, setLoadError] = useState('');
	const [formError, setFormError] = useState('');

	const apply = useCallback((settings: Partial<DocumentSettingsMap[T]> & { updatedAt?: string | null }) => {
		const next = pick(type, settings);
		setValues(next);
		setSaved(next);
		setUpdatedAt(settings.updatedAt ?? null);
	}, [type]);

	useEffect(() => {
		const controller = new AbortController();
		void getDocumentSettings(type, controller.signal)
			.then(apply)
			.catch((error: unknown) => {
				if (!controller.signal.aborted) setLoadError(error instanceof ApiError ? error.message : 'Unable to load these settings.');
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [apply, type]);

	const setField = useCallback(<K extends keyof DocumentSettingsMap[T]>(key: K, value: DocumentSettingsMap[T][K]) => {
		setValues((current) => ({ ...current, [key]: value }));
	}, []);

	const isDirty = (Object.keys(values) as (keyof DocumentSettingsMap[T])[]).some((key) => values[key] !== saved[key]);

	async function submit(event: FormEvent) {
		event.preventDefault();
		setIsSaving(true);
		setFormError('');
		try {
			apply(await updateDocumentSettings(type, values));
			toast({ title: savedMessage, status: 'success', position: 'top' });
		} catch (error) {
			setFormError(error instanceof ApiError ? error.message : 'Unable to save these settings.');
		} finally {
			setIsSaving(false);
		}
	}

	return {
		values,
		setField,
		isDirty,
		isLoading,
		isSaving,
		loadError,
		formError,
		updatedAt,
		submit,
		discard: () => setValues(saved),
		restoreDefaults: () => setValues(DOCUMENT_DEFAULTS[type]),
	};
}

export default useDocumentSettings;
