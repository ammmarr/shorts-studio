import {describe, expect, it} from 'vitest';
import {layoutFor, SAFE_ZONE, YOUTUBE_OVERLAYS} from './layout';
import {CAPTION_POSITIONS} from './themes';

type Box = {x: number; y: number; w: number; h: number};

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('layoutFor', () => {
	for (const position of CAPTION_POSITIONS) {
		it(`keeps everything clear of YouTube's buttons (captions ${position})`, () => {
			const layout = layoutFor(position);
			const scene: Box = {x: layout.left, y: layout.sceneTop, w: 1080 - layout.left - layout.right, h: layout.sceneHeight};
			expect(scene.x).toBeGreaterThanOrEqual(SAFE_ZONE.left);
			expect(scene.x + scene.w).toBeLessThanOrEqual(SAFE_ZONE.right);
			expect(scene.y).toBeGreaterThanOrEqual(SAFE_ZONE.top);
			expect(scene.y + scene.h).toBeLessThanOrEqual(SAFE_ZONE.bottom);
			for (const area of Object.values(YOUTUBE_OVERLAYS)) {
				expect(overlaps(scene, area)).toBe(false);
			}
			expect(layout.brandTop).toBeGreaterThanOrEqual(SAFE_ZONE.top);
		});
	}

	it('never puts captions on top of the scene', () => {
		const top = layoutFor('top');
		expect(top.captionTop! + 200).toBeLessThanOrEqual(top.sceneTop);
		const bottom = layoutFor('bottom');
		expect(bottom.sceneTop + bottom.sceneHeight + 200).toBeLessThanOrEqual(bottom.captionBottom!);
		expect(bottom.captionBottom).toBeLessThanOrEqual(SAFE_ZONE.bottom);
	});
});
