import { useEffect, useState } from 'react';
import { listMasterData } from '../services/masterDataService';
import type { MasterDataItem, MasterDataType } from '../types';
import { useDataChanged } from '../utils/dataSync';

export type MasterDataOptions = Record<MasterDataType, MasterDataItem[]>;

const EMPTY_OPTIONS: MasterDataOptions = { designation: [], employmentType: [], skillCategory: [], workName: [], governmentType: [], area: [] };

function useMasterDataOptions(isEnabled = true) {
	const [options, setOptions] = useState<MasterDataOptions>(EMPTY_OPTIONS);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState('');
	const [isLoaded, setIsLoaded] = useState(false);
	const [reloadVersion, setReloadVersion] = useState(0);
	useDataChanged(['masterData'], () => setReloadVersion((current) => current + 1));

	useEffect(() => {
		if (!isEnabled) return undefined;
		const controller = new AbortController();
		setIsLoading(reloadVersion === 0);
		setError('');
		void listMasterData({ status: 'active' }, controller.signal)
			.then((items) => {
				const grouped: MasterDataOptions = { designation: [], employmentType: [], skillCategory: [], workName: [], governmentType: [], area: [] };
				for (const item of items) grouped[item.type]?.push(item);
				setOptions(grouped);
				setIsLoaded(true);
			})
			.catch(() => {
				if (!controller.signal.aborted) setError('Unable to load dropdown options.');
			})
			.finally(() => {
				if (!controller.signal.aborted) setIsLoading(false);
			});
		return () => controller.abort();
	}, [isEnabled, reloadVersion]);

	return { options, isLoading, isLoaded, error };
}

export function findMasterItem(items: MasterDataItem[], value: string) {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return undefined;
	return items.find((item) => item.code === normalized || item.name.toLowerCase() === normalized);
}

export function masterLabel(items: MasterDataItem[], value: string) {
	return findMasterItem(items, value)?.name || value;
}

export default useMasterDataOptions;
