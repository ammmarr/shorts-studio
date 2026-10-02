import {describe, expect, it} from 'vitest';
import {iconSearchTerms} from '../src/shared/iconKeywords';
import {nodesToBody} from './icons';

describe('nodesToBody', () => {
	it('keeps attributes with digits in their names (x1, y2…)', () => {
		const body = nodesToBody([
			['line', {x1: '10', x2: '14', y1: '2', y2: '2'}],
			['circle', {cx: '12', cy: '14', r: '8'}],
		]);
		expect(body).toBe('<line x1="10" x2="14" y1="2" y2="2"/><circle cx="12" cy="14" r="8"/>');
	});

	it('drops other elements, event handlers, and escapes attribute values', () => {
		const body = nodesToBody([
			['script', {src: 'x'}],
			['path', {d: 'M0 0"/><script', onload: 'alert(1)', key: 'k1'}],
		]);
		expect(body).toBe('<path d="M0 0&quot;/>&lt;script"/>');
	});
});

describe('iconSearchTerms', () => {
	it('passes English through', () => {
		expect(iconSearchTerms(' Heart ')).toEqual(['heart']);
	});

	it('maps Arabic words, with or without the article, to English tags', () => {
		expect(iconSearchTerms('قلب')).toEqual(['heart', 'cardiac']);
		expect(iconSearchTerms('النوم')).toContain('sleep');
		expect(iconSearchTerms('الميه')).toContain('water');
	});

	it('returns nothing for unknown Arabic words', () => {
		expect(iconSearchTerms('زززز')).toEqual([]);
	});
});
