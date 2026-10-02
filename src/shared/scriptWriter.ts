import Anthropic from '@anthropic-ai/sdk';
import {z} from 'zod';
import {ICON_NAMES, isIconName} from './icons';
import type {Dialect, Format, GeneratedScript, Lang} from './types';

// The AI script writer, shared by the computer's server (key in .env) and the phone app (her own
// key, kept on the phone). The caller passes a configured Anthropic client.

const SCENE_KINDS = ['hook', 'point', 'myth', 'fact', 'cta'] as const;

// Structured-output schema: the API guarantees the reply matches it.
const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['title', 'scenes', 'review_notes', 'youtube_title', 'youtube_description', 'hashtags'],
	properties: {
		title: {type: 'string', description: 'Short internal name for the video, 2-6 words.'},
		scenes: {
			type: 'array',
			items: {
				type: 'object',
				additionalProperties: false,
				required: ['kind', 'headline', 'subtext', 'icon', 'narration'],
				properties: {
					kind: {type: 'string', enum: SCENE_KINDS},
					headline: {type: 'string', description: 'On-screen text, at most 6 words. May wrap ONE key word in *asterisks*.'},
					subtext: {type: 'string', description: 'Optional small on-screen line (max 8 words), or empty string.'},
					icon: {type: 'string', enum: ICON_NAMES},
					narration: {type: 'string', description: 'Exactly what the doctor says aloud during this scene.'},
				},
			},
		},
		review_notes: {
			type: 'array',
			items: {type: 'string'},
			description: 'Specific medical claims in the script the doctor should double-check before publishing.',
		},
		youtube_title: {type: 'string'},
		youtube_description: {type: 'string'},
		hashtags: {type: 'array', items: {type: 'string'}, description: 'Without the # sign.'},
	},
} as const;

const ResultSchema = z.object({
	title: z.string(),
	scenes: z
		.array(
			z.object({
				kind: z.enum(SCENE_KINDS),
				headline: z.string(),
				subtext: z.string(),
				icon: z.string(),
				narration: z.string(),
			}),
		)
		.min(2),
	review_notes: z.array(z.string()),
	youtube_title: z.string(),
	youtube_description: z.string(),
	hashtags: z.array(z.string()),
});

const SYSTEM_PROMPT = `You write scripts for a faceless YouTube Shorts channel run by a practicing medical doctor. The video shows animated text cards and icons while the doctor's recorded voice narrates, with word-by-word captions.

What makes a good script here:
- The first scene is a hook the viewer can't scroll past: a surprising fact, a common mistake, or a direct question. It must land in the first 3 seconds. Never open with greetings or "today I'll talk about".
- Total narration is 35-50 seconds read aloud at a relaxed pace: about 90-120 words in English or 75-100 words in Arabic.
- Narration sounds like a warm, confident doctor talking to one patient: short sentences, plain words, first person where natural ("I see this every week in my clinic"). Explain any medical term in simple words.
- Each scene's headline is what appears on screen: at most 6 words, a punchy summary of that scene, not a copy of the narration. Wrap the single most important word in *asterisks* when it helps.
- Subtext is optional and short; use an empty string when the headline is enough.
- Pick the icon that best matches each scene's content.
- The last scene is kind "cta": a one-sentence invitation to follow for more tips, in the doctor's voice.

Medical accuracy comes first. The doctor will publish this under their own name:
- Stay within well-established mainstream guidance. Do not invent statistics, studies, or percentages; only use a number if it is widely established and uncontroversial.
- Do not give drug doses or tell people to start or stop a medication unless the idea explicitly asks for it; then keep it general and point to their own doctor.
- Where relevant, include one clear "see a doctor if..." red flag.
- In review_notes, list each specific medical claim the doctor should verify (max 5), written in English, so they can be checked quickly.

Scene structure by format:
- tips: hook, then 3 point scenes (one tip each), then cta.
- myth_fact: hook, then one or two myth→fact pairs (a myth scene followed by the fact scene that corrects it), then cta.
- qa: hook stating the question patients ask, then 2-3 point scenes that answer it, then cta.

The YouTube title (under 70 characters) and description (2-3 sentences plus a short "educational content, not medical advice" line) must be in the same language as the script. Give 3-6 relevant hashtags without the # sign; include "shorts".`;

const languageInstruction = (lang: Lang, dialect: Dialect) => {
	if (lang === 'en') {
		return 'Write everything in clear, simple English.';
	}
	return dialect === 'egyptian'
		? 'Write the headlines, narration, title and description in warm, clear Egyptian colloquial Arabic (عامية مصرية) that any Egyptian understands. Common medical words may stay in the form Egyptians use in clinics. review_notes stay in English.'
		: 'Write the headlines, narration, title and description in simple, clear Modern Standard Arabic (فصحى مبسطة). review_notes stay in English.';
};

/** A problem worth showing to her as it is (the messages are translated in the app). */
export class ScriptError extends Error {}

export type ScriptInput = {idea: string; format: Format; language: Lang; dialect: Dialect; doctorName: string};

/** Writes a script with Claude. `invalidKeyMessage` says where the key lives on this device. */
export const writeScript = async (client: Anthropic, input: ScriptInput, invalidKeyMessage: string): Promise<GeneratedScript> => {
	const idea = input.idea.trim();
	if (idea.length < 5) {
		throw new ScriptError('Write a sentence about what you want to teach first.');
	}
	const userPrompt = [
		`Doctor: ${input.doctorName || 'the doctor'}`,
		`Format: ${input.format}`,
		languageInstruction(input.language, input.dialect),
		'',
		'What the doctor wants to teach in this Short:',
		idea,
	].join('\n');

	let response: Anthropic.Beta.BetaMessage;
	try {
		response = await client.beta.messages.create({
			model: 'claude-opus-5-5',
			max_tokens: 16000,
			// If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
			betas: ['server-side-fallback-2026-07-01'],
			fallbacks: 'default',
			output_config: {effort: 'medium', format: {type: 'json_schema', schema: SCHEMA}},
			system: SYSTEM_PROMPT,
			messages: [{role: 'user', content: userPrompt}],
		});
	} catch (error) {
		if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
			throw new ScriptError(invalidKeyMessage);
		}
		if (error instanceof Anthropic.RateLimitError) {
			throw new ScriptError('The AI is busy right now. Please try again in a minute.');
		}
		if (error instanceof Anthropic.APIConnectionError) {
			throw new ScriptError('Could not reach the AI. Check the internet connection and try again.');
		}
		if (error instanceof Anthropic.APIError) {
			throw new ScriptError(`The AI had a problem (${error.status ?? 'unknown'}). Please try again.`);
		}
		throw error;
	}

	if (response.stop_reason === 'refusal') {
		throw new ScriptError('The AI could not write this one. Try describing the idea a little differently.');
	}
	if (response.stop_reason === 'max_tokens') {
		throw new ScriptError('The script came out too long. Please try again.');
	}
	const text = response.content.find((block) => block.type === 'text')?.text;
	const parsed = ResultSchema.safeParse(text ? JSON.parse(text) : null);
	if (!parsed.success) {
		throw new ScriptError('The AI reply was incomplete. Please try again.');
	}
	const result = parsed.data;
	return {
		title: result.title,
		scenes: result.scenes.map((scene) => ({
			id: crypto.randomUUID(),
			kind: scene.kind,
			headline: scene.headline,
			subtext: scene.subtext,
			icon: isIconName(scene.icon) ? scene.icon : 'lightbulb',
			narration: scene.narration,
			image: null,
		})),
		reviewNotes: result.review_notes.slice(0, 5),
		youtube: {
			title: result.youtube_title,
			description: result.youtube_description,
			hashtags: result.hashtags.map((h) => h.replace(/^#/, '').trim()).filter(Boolean),
		},
	};
};
