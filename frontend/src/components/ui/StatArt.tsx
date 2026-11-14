/** Small decorative illustrations for stat cards. Gradient ids are unique per illustration, so each may appear once per page. */

export function BuildingsArt() {
	const windows = Array.from({ length: 21 }, (_, index) => ({ x: 43 + (index % 3) * 7.5, y: 21 + Math.floor(index / 3) * 10 }));
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-bld-front" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#60A5FA" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
				<linearGradient id="art-bld-side" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3B82F6" /><stop offset="1" stopColor="#1E40AF" /></linearGradient>
				<linearGradient id="art-bld-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#BFDBFE" /><stop offset="1" stopColor="#60A5FA" /></linearGradient>
			</defs>
			<ellipse cx="52" cy="95" rx="42" ry="4" fill="#2563EB" opacity="0.15" />
			<rect x="10" y="38" width="28" height="56" rx="2" fill="url(#art-bld-back)" />
			{[0, 1, 2, 3, 4].map((row) => [0, 1].map((col) => (
				<rect key={`${row}-${col}`} x={15 + col * 10} y={45 + row * 9} width="6" height="5" rx="1" fill="white" opacity="0.7" />
			)))}
			<path d="M40 14h26v80H40Z" fill="url(#art-bld-front)" />
			<path d="M66 14l12-6v80l-12 6Z" fill="url(#art-bld-side)" />
			<path d="M40 14l12-6h26l-12 6Z" fill="#BFDBFE" />
			{windows.map((w) => <rect key={`${w.x}-${w.y}`} x={w.x} y={w.y} width="4.5" height="6" rx="0.8" fill="white" opacity="0.8" />)}
			{[0, 1, 2, 3, 4, 5, 6].map((row) => <path key={row} d={`M69 ${22 + row * 10}l6-3v5l-6 3Z`} fill="white" opacity="0.35" />)}
			<path d="M78 60h14v34H78Z" fill="url(#art-bld-back)" />
			{[0, 1, 2].map((row) => <rect key={row} x="82" y={65 + row * 9} width="6" height="5" rx="1" fill="white" opacity="0.7" />)}
		</svg>
	);
}

export function CheckArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-check-outer" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#86EFAC" /><stop offset="1" stopColor="#16A34A" /></linearGradient>
				<linearGradient id="art-check-inner" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4ADE80" /><stop offset="1" stopColor="#15803D" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="94" rx="30" ry="4" fill="#16A34A" opacity="0.18" />
			<circle cx="50" cy="48" r="40" fill="url(#art-check-outer)" />
			<circle cx="50" cy="48" r="31" fill="url(#art-check-inner)" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
			<path d="M26 30a30 30 0 0 1 22-14" stroke="white" strokeOpacity="0.45" strokeWidth="4" strokeLinecap="round" fill="none" />
			<path d="M35 49l10 10 21-22" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
		</svg>
	);
}

export function HourglassArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-hg-cap" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FCD34D" /><stop offset="1" stopColor="#D97706" /></linearGradient>
				<linearGradient id="art-hg-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FDBA74" /><stop offset="1" stopColor="#EA580C" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="95" rx="30" ry="3.5" fill="#D97706" opacity="0.18" />
			<rect x="29" y="16" width="4" height="68" rx="2" fill="#B45309" opacity="0.85" />
			<rect x="67" y="16" width="4" height="68" rx="2" fill="#B45309" opacity="0.85" />
			<path d="M35 16h30c0 18-11 26-11 34s11 16 11 34H35c0-18 11-26 11-34s-11-16-11-34Z" fill="#FFF7ED" fillOpacity="0.9" stroke="#FDBA74" strokeWidth="1.5" />
			<path d="M39 26h22c-2 10-9 15-11 21-2-6-9-11-11-21Z" fill="url(#art-hg-sand)" />
			<rect x="49.3" y="47" width="1.4" height="20" fill="#F97316" />
			<path d="M38 82c3-10 8-13 12-15 4 2 9 5 12 15Z" fill="url(#art-hg-sand)" />
			<path d="M38 20c1 6 3 10 6 14" stroke="white" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" fill="none" />
			<rect x="22" y="7" width="56" height="10" rx="4" fill="url(#art-hg-cap)" />
			<rect x="22" y="83" width="56" height="10" rx="4" fill="url(#art-hg-cap)" />
		</svg>
	);
}

const SHIELD_PALETTES = {
	red: ['#F87171', '#DC2626'],
	orange: ['#FDBA74', '#EA580C'],
} as const;

export function ShieldArt({ palette = 'red' }: { palette?: keyof typeof SHIELD_PALETTES }) {
	const [from, to] = SHIELD_PALETTES[palette];
	const id = `art-shield-${palette}`;
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient>
			</defs>
			<ellipse cx="50" cy="95" rx="28" ry="3.5" fill={to} opacity="0.18" />
			<path d="M50 6l33 12v26c0 23-14 39-33 47C31 83 17 67 17 44V18Z" fill={`url(#${id})`} />
			<path d="M50 6L17 18v26c0 23 14 39 33 47Z" fill="white" opacity="0.12" />
			<path d="M50 14l26 9.5V44c0 18-11 31-26 38-15-7-26-20-26-38V23.5Z" fill="none" stroke="white" strokeOpacity="0.35" strokeWidth="2" />
			<path d="M39 37l22 22M61 37L39 59" stroke="white" strokeWidth="8" strokeLinecap="round" />
		</svg>
	);
}

export function ClockArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-clock-ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C7D2FE" /><stop offset="1" stopColor="#818CF8" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="95" rx="30" ry="3.5" fill="#4F46E5" opacity="0.15" />
			<circle cx="50" cy="48" r="42" fill="url(#art-clock-ring)" />
			<circle cx="50" cy="48" r="33" fill="#EEF2FF" />
			{[0, 90, 180, 270].map((angle) => (
				<rect key={angle} x="48.5" y="18" width="3" height="7" rx="1.5" fill="#A5B4FC" transform={`rotate(${angle} 50 48)`} />
			))}
			<path d="M50 28v20l14 10" stroke="#6366F1" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
			<circle cx="50" cy="48" r="4" fill="#6366F1" />
		</svg>
	);
}

export function PinArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-pin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7DD3FC" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="90" rx="26" ry="6" fill="#2563EB" opacity="0.15" />
			<ellipse cx="50" cy="90" rx="12" ry="3" fill="#2563EB" opacity="0.25" />
			<path d="M50 6c-17.7 0-30 13-30 29.5C20 58 50 88 50 88s30-30 30-52.5C80 19 67.7 6 50 6Z" fill="url(#art-pin)" />
			<path d="M50 6c-17.7 0-30 13-30 29.5C20 58 50 88 50 88Z" fill="white" opacity="0.12" />
			<circle cx="50" cy="35" r="12" fill="white" />
			<circle cx="50" cy="35" r="5" fill="#3B82F6" opacity="0.6" />
		</svg>
	);
}

const PEOPLE_PALETTES = {
	green: { front: ['#4ADE80', '#15803D'], back: ['#BBF7D0', '#4ADE80'], shadow: '#16A34A', opacity: 1 },
	brand: { front: ['#C7D2FE', '#818CF8'], back: ['#E0E7FF', '#A5B4FC'], shadow: '#4F46E5', opacity: 0.75 },
	red: { front: ['#FECACA', '#F87171'], back: ['#FEE2E2', '#FCA5A5'], shadow: '#DC2626', opacity: 0.75 },
} as const;

/** Group of people; `single` draws one figure (e.g. for "inactive"). */
export function PeopleArt({ palette = 'green', single = false }: { palette?: keyof typeof PEOPLE_PALETTES; single?: boolean }) {
	const colors = PEOPLE_PALETTES[palette];
	const front = `art-people-front-${palette}`;
	const back = `art-people-back-${palette}`;
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true" opacity={colors.opacity}>
			<defs>
				<linearGradient id={front} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colors.front[0]} /><stop offset="1" stopColor={colors.front[1]} /></linearGradient>
				<linearGradient id={back} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={colors.back[0]} /><stop offset="1" stopColor={colors.back[1]} /></linearGradient>
			</defs>
			<ellipse cx="50" cy="94" rx={single ? 28 : 38} ry="4" fill={colors.shadow} opacity="0.15" />
			{single ? null : (
				<>
					<circle cx="26" cy="36" r="11" fill={`url(#${back})`} />
					<path d="M8 86c0-16 8-26 18-26s18 10 18 26Z" fill={`url(#${back})`} />
					<circle cx="74" cy="36" r="11" fill={`url(#${back})`} />
					<path d="M56 86c0-16 8-26 18-26s18 10 18 26Z" fill={`url(#${back})`} />
				</>
			)}
			<circle cx="50" cy="30" r="15" fill={`url(#${front})`} />
			<path d="M24 90c0-22 11-36 26-36s26 14 26 36Z" fill={`url(#${front})`} />
			<path d="M42 22a10 10 0 0 1 8-5" stroke="white" strokeOpacity="0.5" strokeWidth="3" strokeLinecap="round" fill="none" />
		</svg>
	);
}

export function CalendarCheckArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-cal-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4ADE80" /><stop offset="1" stopColor="#16A34A" /></linearGradient>
				<linearGradient id="art-cal-badge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4ADE80" /><stop offset="1" stopColor="#15803D" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="94" rx="38" ry="4" fill="#16A34A" opacity="0.15" />
			<rect x="8" y="18" width="74" height="70" rx="10" fill="#F0FDF4" stroke="#BBF7D0" strokeWidth="2" />
			<path d="M8 28a10 10 0 0 1 10-10h54a10 10 0 0 1 10 10v8H8Z" fill="url(#art-cal-top)" />
			<rect x="24" y="10" width="7" height="16" rx="3.5" fill="#15803D" />
			<rect x="59" y="10" width="7" height="16" rx="3.5" fill="#15803D" />
			{[0, 1, 2].map((row) => [0, 1, 2, 3].map((col) => (
				<rect key={`${row}-${col}`} x={17 + col * 15} y={44 + row * 13} width="9" height="7" rx="2" fill="#86EFAC" opacity={row === 2 && col > 1 ? 0 : 0.7} />
			)))}
			<circle cx="72" cy="74" r="18" fill="url(#art-cal-badge)" stroke="white" strokeWidth="3" />
			<path d="M63 74l6 6 11-12" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
		</svg>
	);
}

export function AbsentArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-absent-person" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FECACA" /><stop offset="1" stopColor="#F87171" /></linearGradient>
				<linearGradient id="art-absent-badge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#F87171" /><stop offset="1" stopColor="#DC2626" /></linearGradient>
			</defs>
			<ellipse cx="46" cy="94" rx="30" ry="4" fill="#DC2626" opacity="0.15" />
			<g opacity="0.8">
				<circle cx="44" cy="30" r="16" fill="url(#art-absent-person)" />
				<path d="M16 92c0-24 12-38 28-38s28 14 28 38Z" fill="url(#art-absent-person)" />
			</g>
			<circle cx="72" cy="74" r="16" fill="url(#art-absent-badge)" stroke="white" strokeWidth="3" />
			<path d="M66 68l12 12M78 68L66 80" stroke="white" strokeWidth="4.5" strokeLinecap="round" />
		</svg>
	);
}

export function ChartArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-chart-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#60A5FA" /><stop offset="1" stopColor="#1D4ED8" /></linearGradient>
				<linearGradient id="art-chart-arrow" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#93C5FD" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
			</defs>
			<ellipse cx="52" cy="92" rx="42" ry="4" fill="#2563EB" opacity="0.15" />
			<path d="M8 88h84" stroke="#BFDBFE" strokeWidth="3" strokeLinecap="round" />
			<rect x="14" y="64" width="13" height="24" rx="3" fill="url(#art-chart-bar)" opacity="0.55" />
			<rect x="33" y="52" width="13" height="36" rx="3" fill="url(#art-chart-bar)" opacity="0.7" />
			<rect x="52" y="40" width="13" height="48" rx="3" fill="url(#art-chart-bar)" opacity="0.85" />
			<rect x="71" y="26" width="13" height="62" rx="3" fill="url(#art-chart-bar)" />
			<path d="M10 52l20-14 16 8 30-28" stroke="url(#art-chart-arrow)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
			<path d="M66 14h14v14" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
		</svg>
	);
}

export function CalendarArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-calendar-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#93C5FD" /><stop offset="1" stopColor="#3B82F6" /></linearGradient>
				<linearGradient id="art-calendar-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#60A5FA" /><stop offset="1" stopColor="#2563EB" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="94" rx="38" ry="4" fill="#2563EB" opacity="0.15" />
			<g opacity="0.85">
				<rect x="10" y="18" width="80" height="72" rx="12" fill="url(#art-calendar-body)" />
				<path d="M10 30a12 12 0 0 1 12-12h56a12 12 0 0 1 12 12v8H10Z" fill="url(#art-calendar-top)" />
				<rect x="26" y="9" width="8" height="18" rx="4" fill="#1D4ED8" />
				<rect x="66" y="9" width="8" height="18" rx="4" fill="#1D4ED8" />
				<rect x="22" y="48" width="56" height="30" rx="5" fill="white" opacity="0.85" />
				<rect x="28" y="54" width="28" height="5" rx="2.5" fill="#60A5FA" />
				<rect x="28" y="64" width="40" height="5" rx="2.5" fill="#BFDBFE" />
			</g>
		</svg>
	);
}

export function WalletArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-wallet-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#86EFAC" /><stop offset="1" stopColor="#16A34A" /></linearGradient>
				<linearGradient id="art-wallet-flap" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4ADE80" /><stop offset="1" stopColor="#15803D" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="92" rx="40" ry="4" fill="#16A34A" opacity="0.15" />
			<g opacity="0.9">
				<path d="M22 22l44-12a6 6 0 0 1 7.4 4.2L76 24H22Z" fill="#BBF7D0" />
				<rect x="8" y="24" width="80" height="62" rx="12" fill="url(#art-wallet-body)" />
				<path d="M62 44h28a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H62a12 12 0 0 1 0-24Z" fill="url(#art-wallet-flap)" />
				<circle cx="64" cy="56" r="5" fill="white" />
				<path d="M16 34h40" stroke="white" strokeOpacity="0.4" strokeWidth="3" strokeLinecap="round" />
			</g>
		</svg>
	);
}

export function ReceiptArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-receipt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFEDD5" /><stop offset="1" stopColor="#FDBA74" /></linearGradient>
				<linearGradient id="art-receipt-coin" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FDBA74" /><stop offset="1" stopColor="#EA580C" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="94" rx="36" ry="4" fill="#EA580C" opacity="0.15" />
			<g opacity="0.9">
				<path d="M16 8h56a6 6 0 0 1 6 6v76l-8-5-8 5-8-5-8 5-8-5-8 5-8-5-8 5V14a6 6 0 0 1 6-6Z" fill="url(#art-receipt)" />
				<rect x="24" y="20" width="36" height="5" rx="2.5" fill="#FB923C" opacity="0.8" />
				<rect x="24" y="32" width="44" height="4" rx="2" fill="#FDBA74" />
				<rect x="24" y="42" width="30" height="4" rx="2" fill="#FDBA74" />
				<rect x="24" y="52" width="38" height="4" rx="2" fill="#FDBA74" />
			</g>
			<circle cx="72" cy="70" r="18" fill="url(#art-receipt-coin)" stroke="white" strokeWidth="3" />
			<path d="M65 62h14M65 67h14M68 62c7 0 7 10 0 10h-3l10 9" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
		</svg>
	);
}

export function BoxArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-box-left" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#4ADE80" /><stop offset="1" stopColor="#16A34A" /></linearGradient>
				<linearGradient id="art-box-right" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#22C55E" /><stop offset="1" stopColor="#15803D" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="93" rx="38" ry="4" fill="#16A34A" opacity="0.15" />
			<path d="M50 8l38 20-38 20-38-20Z" fill="#BBF7D0" />
			<path d="M12 28l38 20v42L12 70Z" fill="url(#art-box-left)" />
			<path d="M88 28L50 48v42l38-20Z" fill="url(#art-box-right)" />
			<path d="M31 18l38 20v14l-8 4V42L23 22Z" fill="#DCFCE7" opacity="0.9" />
			<path d="M61 42v14l8-4V38Z" fill="#86EFAC" />
			<path d="M20 60l14 7" stroke="white" strokeOpacity="0.6" strokeWidth="3" strokeLinecap="round" />
		</svg>
	);
}

export function PercentArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-percent" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#A5B4FC" /><stop offset="1" stopColor="#4F46E5" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="94" rx="32" ry="4" fill="#4F46E5" opacity="0.15" />
			<path d="M50 6l9 7 11-2 4 10 10 5-2 11 7 9-7 9 2 11-10 5-4 10-11-2-9 7-9-7-11 2-4-10-10-5 2-11-7-9 7-9-2-11 10-5 4-10 11 2Z" fill="url(#art-percent)" />
			<path d="M50 14a34 34 0 0 0-26 12" stroke="white" strokeOpacity="0.35" strokeWidth="3" strokeLinecap="round" fill="none" />
			<path d="M36 64l28-32" stroke="white" strokeWidth="6" strokeLinecap="round" />
			<circle cx="37" cy="36" r="7" fill="none" stroke="white" strokeWidth="5" />
			<circle cx="63" cy="60" r="7" fill="none" stroke="white" strokeWidth="5" />
		</svg>
	);
}

export function WarningArt() {
	return (
		<svg viewBox="0 0 100 100" width="100%" height="100%" aria-hidden="true">
			<defs>
				<linearGradient id="art-warn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FCD34D" /><stop offset="1" stopColor="#EA580C" /></linearGradient>
			</defs>
			<ellipse cx="50" cy="94" rx="36" ry="4" fill="#EA580C" opacity="0.18" />
			<path d="M44 12a7 7 0 0 1 12 0l38 66a7 7 0 0 1-6 10.5H12A7 7 0 0 1 6 78Z" fill="url(#art-warn)" />
			<path d="M44 12a7 7 0 0 1 6-3.5V88.5H12A7 7 0 0 1 6 78Z" fill="white" opacity="0.12" />
			<rect x="45" y="32" width="10" height="32" rx="5" fill="white" />
			<circle cx="50" cy="75" r="5.5" fill="white" />
		</svg>
	);
}
