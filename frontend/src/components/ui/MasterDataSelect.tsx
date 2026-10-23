import { Select, type SelectProps } from '@chakra-ui/react';
import { findMasterItem } from '../../hooks/useMasterDataOptions';
import type { MasterDataItem } from '../../types';

type MasterDataSelectProps = Omit<SelectProps, 'value' | 'onChange'> & {
	items: MasterDataItem[];
	value: string;
	valueKey: 'name' | 'code';
	placeholder?: string;
	onChange: (value: string) => void;
};

function MasterDataSelect({ items, value, valueKey, placeholder, onChange, ...selectProps }: MasterDataSelectProps) {
	const matched = findMasterItem(items, value);
	const selectedValue = matched ? matched[valueKey] : value;
	const hasLegacyValue = Boolean(value) && !matched;

	return (
		<Select {...selectProps} value={selectedValue} onChange={(event) => onChange(event.target.value)}>
			{placeholder !== undefined ? <option value="">{placeholder}</option> : null}
			{hasLegacyValue ? <option value={value} disabled>{`${value} (not in Settings → Master data)`}</option> : null}
			{items.map((item) => (
				<option key={item.id} value={item[valueKey]}>{item.name}</option>
			))}
		</Select>
	);
}

export default MasterDataSelect;
