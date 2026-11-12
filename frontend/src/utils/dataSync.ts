import { useEffect, useRef } from 'react';

/** Data whose change makes other open screens stale; pay depends on master data rates and an organization's government type and area. */
export type DataTopic = 'masterData' | 'organizations';

const EVENT_NAME = 'shreeji:data-changed';
const CHANNEL_NAME = 'shreeji-data-sync';

function openChannel() {
	return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(CHANNEL_NAME);
}

/** Tells every open screen in this tab and in other tabs of the app that `topic` changed on the server. */
export function notifyDataChanged(topic: DataTopic) {
	const channel = openChannel();
	if (!channel) {
		window.dispatchEvent(new CustomEvent<DataTopic>(EVENT_NAME, { detail: topic }));
		return;
	}
	// A channel delivers to every other channel of the same name, including listeners in this tab.
	channel.postMessage(topic);
	channel.close();
}

/** Calls `onChange` whenever one of `topics` changes in this tab or another tab of the app. */
export function useDataChanged(topics: DataTopic[], onChange: () => void) {
	const onChangeRef = useRef(onChange);
	onChangeRef.current = onChange;
	const topicKey = topics.join('|');

	useEffect(() => {
		const watched = new Set(topicKey.split('|'));
		const handle = (topic: unknown) => {
			if (typeof topic === 'string' && watched.has(topic)) onChangeRef.current();
		};
		const handleEvent = (event: Event) => handle((event as CustomEvent<DataTopic>).detail);
		const channel = openChannel();
		if (channel) {
			channel.onmessage = (event: MessageEvent) => handle(event.data);
			return () => channel.close();
		}
		window.addEventListener(EVENT_NAME, handleEvent);
		return () => window.removeEventListener(EVENT_NAME, handleEvent);
	}, [topicKey]);
}
