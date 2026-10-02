import {DEFAULT_SETTINGS, newProject} from '../shared/project';
import {buildVideoProps} from '../shared/timeline';
import type {Lang, Project, Scene, Settings} from '../shared/types';

const scene = (id: string, kind: Scene['kind'], icon: Scene['icon'], headline: string, subtext: string, narration: string): Scene => ({
	id,
	kind,
	icon,
	image: null,
	headline,
	subtext,
	narration,
});

const SCENES: Record<Lang, Scene[]> = {
	en: [
		scene('1', 'hook', 'glass-water', 'Are you drinking water *wrong*?', '', 'Most people drink water the wrong way, and it matters more than you think.'),
		scene('2', 'point', 'timer', 'Sip, don’t *chug*', 'Small amounts through the day', 'First, sip small amounts through the day instead of chugging a full bottle at once.'),
		scene('3', 'myth', 'droplet', 'Everyone needs exactly 8 glasses', '', 'You may have heard that everyone needs exactly eight glasses a day.'),
		scene('4', 'fact', 'activity', 'Your needs change with *heat* and activity', '', 'In fact, it depends on your body, the weather, and how active you are.'),
		scene('5', 'cta', 'heart-pulse', 'Follow for more', '', 'Follow for more simple health tips.'),
	],
	ar: [
		scene('1', 'hook', 'glass-water', 'بتشرب المية *غلط*؟', '', 'أغلب الناس بيشربوا المية بطريقة غلط، وده بيفرق أكتر مما تتخيل.'),
		scene('2', 'point', 'timer', 'اشرب على *مراحل*', 'كميات صغيرة طول اليوم', 'أولاً، اشرب كميات صغيرة طول اليوم بدل ما تشرب زجاجة كاملة مرة واحدة.'),
		scene('3', 'myth', 'droplet', 'كل الناس محتاجة ٨ كوبايات بالظبط', '', 'أكيد سمعت إن كل الناس محتاجة تمن كوبايات في اليوم بالظبط.'),
		scene('4', 'fact', 'activity', 'احتياجك بيتغير مع *الحر* والمجهود', '', 'الحقيقة إن ده بيعتمد على جسمك، والجو، ومجهودك اليومي.'),
		scene('5', 'cta', 'heart-pulse', 'تابعني', '', 'تابعني لنصايح صحية أكتر.'),
	],
};

export const SAMPLE_SETTINGS: Settings = {
	...DEFAULT_SETTINGS,
	doctorName: 'Dr. Mona',
	handle: '@drmona.health',
	setupDone: true,
};

export const sampleProject = (lang: Lang, themeId: Project['themeId'] = 'clinic'): Project => ({
	...newProject('myth_fact', lang, SAMPLE_SETTINGS),
	id: 'sample',
	title: 'Drinking water',
	scenes: SCENES[lang],
	themeId,
});

export const SAMPLE_PROPS = buildVideoProps(sampleProject('en'), SAMPLE_SETTINGS);
