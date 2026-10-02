import Anthropic from '@anthropic-ai/sdk';
import {ScriptError, type ScriptInput, writeScript} from '../src/shared/scriptWriter';
import type {GeneratedScript} from '../src/shared/types';
import {UserError} from './paths';

export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY?.trim());

export const generateScript = async (input: ScriptInput): Promise<GeneratedScript> => {
	if (!aiEnabled()) {
		throw new UserError('AI writing is not set up yet. Add an ANTHROPIC_API_KEY to the .env file.');
	}
	try {
		return await writeScript(new Anthropic(), input, 'The AI key in the .env file is not valid.');
	} catch (error) {
		throw error instanceof ScriptError ? new UserError(error.message) : error;
	}
};
