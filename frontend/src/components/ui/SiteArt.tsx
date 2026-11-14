import { Box } from '@chakra-ui/react';

const GROUND = 100;

function tower(cx: number, top: number) {
	const height = GROUND - top;
	const leftX = (y: number) => cx - 2 - (8 * (y - top)) / height;
	const rightX = (y: number) => cx + 2 + (8 * (y - top)) / height;
	const levels = [top + 8, top + 17, top + 17 + (height - 17) / 3, top + 17 + ((height - 17) * 2) / 3, GROUND];
	const bracing = levels.slice(1).map((y2, index) => {
		const y1 = levels[index];
		return `M${leftX(y1)} ${y1}L${rightX(y2)} ${y2}M${rightX(y1)} ${y1}L${leftX(y2)} ${y2}`;
	}).join('');
	return [
		`M${cx - 10} ${GROUND}L${cx - 2} ${top}H${cx + 2}L${cx + 10} ${GROUND}`,
		`M${cx - 2} ${top}l${2} -5l${2} 5`,
		`M${cx - 13} ${top + 8}H${cx + 13}M${cx - 10} ${top + 17}H${cx + 10}`,
		`M${cx - 13} ${top + 8}v3M${cx + 13} ${top + 8}v3M${cx - 10} ${top + 17}v3M${cx + 10} ${top + 17}v3`,
		bracing,
	].join('');
}

const columns = [92, 101, 110, 119, 128];

/** Decorative hydro-power scene (dam, powerhouse, transmission towers); inherits `color`. */
function SiteArt({ width = 300 }: { width?: number }) {
	return (
		<Box
			as="svg"
			viewBox="0 0 300 104"
			width={`${width}px`}
			height="auto"
			display="block"
			fill="none"
			stroke="currentColor"
			strokeWidth="1"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M0 100C30 74 52 70 80 82s40-24 74-20 50 22 80 14 46-6 66 10v16H0Z" fill="currentColor" fillOpacity="0.06" stroke="none" />
			<path d="M120 100c26-14 54-20 86-12s56 4 94 2v14H120Z" fill="currentColor" fillOpacity="0.05" stroke="none" />

			<path d="M14 92c5-2 9 2 14 0s9 2 14 0M20 97c5-2 9 2 14 0" opacity="0.5" />
			<path d="M44 100l4-30h12l4 30Z" fill="white" fillOpacity="0.7" />
			<path d="M50 74v26M56 74v26" opacity="0.6" />
			<path d="M64 100V86h10v14" fill="white" fillOpacity="0.7" />

			<path d="M82 76l29-14 29 14Z" fill="white" fillOpacity="0.8" />
			<path d="M82 76h58v4H82Z" fill="white" fillOpacity="0.8" />
			{columns.map((x) => <path key={x} d={`M${x} 80v18h3V80`} fill="white" fillOpacity="0.8" />)}
			<path d="M80 98h62v2H80Z" fill="white" fillOpacity="0.8" />
			<circle cx="111" cy="70" r="2.2" />

			<path d={tower(172, 40)} />
			<path d={tower(212, 26)} />
			<path d="M140 76c10 6 18 0 19-25M185 51c10 8 20 6 14-17M182 60c10 8 20 6 20-17M225 37c18 10 40 12 70 6M222 46c18 10 40 12 73 6" opacity="0.7" />

			<path d="M6 100.5h258" />
		</Box>
	);
}

export default SiteArt;
