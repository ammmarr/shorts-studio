import React from 'react';

const SKIN = '#F6C9A3';
const OUTLINE = '#B97A56';

/**
 * A cartoon right hand holding a marker. The marker's tip is at the element's top-left corner
 * (0,0), so positioning the element positions the pen. `ink` colours the nib and band.
 */
export const Hand: React.FC<{ink: string; sleeve: string; scale?: number}> = ({ink, sleeve, scale = 1}) => (
	<svg
		width={420 * scale}
		height={420 * scale}
		viewBox="0 0 420 420"
		style={{position: 'absolute', left: 0, top: 0, overflow: 'visible', filter: 'drop-shadow(0 14px 18px rgba(0,0,0,0.22))'}}
	>
		<g transform="rotate(-35)" strokeLinejoin="round">
			{/* sleeve and cuff */}
			<rect x={16} y={200} width={124} height={170} rx={26} fill={sleeve} />
			<rect x={10} y={190} width={136} height={30} rx={14} fill="#F8FAFC" stroke="#CBD5E1" strokeWidth={3} />
			{/* back of the hand */}
			<rect x={-6} y={92} width={132} height={114} rx={54} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
			{/* marker */}
			<polygon points="0,0 -8,22 8,22" fill={ink} />
			<rect x={-11} y={20} width={22} height={16} rx={3} fill="#E5E7EB" />
			<rect x={-15} y={34} width={30} height={236} rx={12} fill="#1F2937" />
			<rect x={-15} y={232} width={30} height={14} fill={ink} />
			{/* curled fingers wrap the marker */}
			<rect x={-32} y={126} width={74} height={32} rx={16} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
			<rect x={-28} y={154} width={70} height={32} rx={16} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
			<rect x={-22} y={182} width={62} height={28} rx={14} fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
			{/* thumb */}
			<ellipse cx={-12} cy={104} rx={22} ry={36} transform="rotate(22 -12 104)" fill={SKIN} stroke={OUTLINE} strokeWidth={4} />
			<path d="M 60 110 q 14 -8 28 0" fill="none" stroke={OUTLINE} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
		</g>
	</svg>
);
