// Hand-picked health icons. Each also has a built-in fallback component in src/remotion/icons.tsx,
// so videos still render them if the icon library can't be downloaded. Labels are search keywords.
export const ICONS = [
	['heart-pulse', 'heart pulse cardio blood pressure'],
	['heart', 'heart love cardiac'],
	['brain', 'brain mind memory headache stress'],
	['stethoscope', 'doctor checkup exam'],
	['pill', 'pill medicine drug'],
	['tablets', 'tablets medicine dose'],
	['syringe', 'injection vaccine needle'],
	['thermometer', 'fever temperature'],
	['droplet', 'blood drop sugar'],
	['glass-water', 'water hydration drink'],
	['apple', 'apple fruit healthy food'],
	['salad', 'salad vegetables diet'],
	['carrot', 'carrot vegetable vitamin'],
	['fish', 'fish omega protein'],
	['egg', 'egg protein breakfast'],
	['milk', 'milk dairy calcium'],
	['wheat', 'wheat grain gluten fiber'],
	['candy', 'sugar sweets candy'],
	['coffee', 'coffee caffeine tea'],
	['utensils', 'meal eating food'],
	['soup', 'soup warm food'],
	['baby', 'baby child kids pregnancy'],
	['bone', 'bone joints calcium'],
	['eye', 'eye vision'],
	['ear', 'ear hearing'],
	['face-slightly-smiling', 'smile teeth mood happy'],
	['activity', 'activity heart rate pulse'],
	['shield-check', 'immunity protection safe'],
	['moon', 'sleep night'],
	['sun', 'sun vitamin d skin morning'],
	['bed', 'bed rest sleep'],
	['dumbbell', 'exercise gym strength'],
	['footprints', 'walking steps'],
	['bike', 'cycling cardio'],
	['person-standing', 'person body posture'],
	['cigarette-off', 'no smoking quit'],
	['wine-off', 'no alcohol'],
	['scale', 'weight scale obesity'],
	['clock', 'time clock'],
	['timer', 'timer minutes duration'],
	['calendar', 'calendar schedule days'],
	['triangle-alert', 'warning danger alert red flag'],
	['ban', 'stop avoid forbidden'],
	['circle-check', 'correct yes check'],
	['circle-x', 'wrong no mistake'],
	['circle-question-mark', 'question why help'],
	['lightbulb', 'tip idea'],
	['microscope', 'lab test research'],
	['dna', 'genes genetics'],
	['bandage', 'wound first aid injury'],
	['hospital', 'hospital clinic'],
	['ambulance', 'emergency ambulance'],
	['hand-heart', 'care support'],
	['users', 'family people'],
	['bug', 'germs bacteria virus infection'],
	['biohazard', 'infection contagious'],
	['wind', 'breathing lungs air asthma'],
	['leaf', 'natural herbs'],
	['flame', 'inflammation burn heat'],
	['snowflake', 'cold winter flu'],
	['zap', 'energy fast'],
	['battery-low', 'fatigue tired low energy'],
	['sparkles', 'skin glow beauty clean'],
] as const;

/** The hand-picked health icons: offered first in the picker and to the AI script writer. */
export type CuratedIconName = (typeof ICONS)[number][0];

/** Any Lucide icon name (the full set of ~1,850 is served by the app's server). */
export type IconName = string;

export const ICON_NAMES: CuratedIconName[] = ICONS.map(([name]) => name);

export const isIconName = (value: unknown): value is IconName =>
	typeof value === 'string' && value.length <= 64 && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(value);

/** Old names Lucide has since renamed, still found in earlier projects. */
export const ICON_ALIASES: Record<string, string> = {
	smile: 'face-slightly-smiling',
	'circle-help': 'circle-question-mark',
};

export const isCuratedIcon = (value: string): value is CuratedIconName => (ICON_NAMES as string[]).includes(value);
