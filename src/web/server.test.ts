import {describe, expect, it} from 'vitest';
import {normalizeServer} from './server';

describe('normalizeServer', () => {
	it('accepts the address the way the computer shows it', () => {
		expect(normalizeServer('192.168.1.5:3100')).toBe('http://192.168.1.5:3100');
		expect(normalizeServer(' http://192.168.1.5:3100/ ')).toBe('http://192.168.1.5:3100');
	});

	it('adds the usual port when it is left out', () => {
		expect(normalizeServer('192.168.1.5')).toBe('http://192.168.1.5:3100');
	});

	it('understands Arabic digits and separators from an Arabic keyboard', () => {
		expect(normalizeServer('١٩٢٫١٦٨٫١٫٥:٣١٠٠')).toBe('http://192.168.1.5:3100');
		expect(normalizeServer('192,168,1,5')).toBe('http://192.168.1.5:3100');
	});

	it('keeps https addresses (a cloud server) as they are', () => {
		expect(normalizeServer('https://tabeba.example.com')).toBe('https://tabeba.example.com');
	});

	it('rejects empty or broken input', () => {
		expect(normalizeServer('')).toBeNull();
		expect(normalizeServer('http://')).toBeNull();
	});
});
