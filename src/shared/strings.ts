import type {Lang} from './types';

/** Text that appears inside the video itself, per video language. */
export const VIDEO_STRINGS: Record<
	Lang,
	{
		myth: string;
		fact: string;
		follow: string;
		subscribe: string;
		disclaimer: string;
		trueWord: string;
		falseWord: string;
		quiz: string;
		trueOrFalse: string;
		answer: string;
		tip: string;
		online: string;
		typing: string;
		search: string;
		score: string;
		commentScore: string;
		didYouKnow: string;
	}
> = {
	en: {
		myth: 'MYTH',
		fact: 'FACT',
		follow: 'Follow for more health tips',
		subscribe: 'Subscribe',
		disclaimer: 'For education only. Not a substitute for medical advice.',
		trueWord: 'TRUE',
		falseWord: 'FALSE',
		quiz: 'HEALTH QUIZ',
		trueOrFalse: 'True or false?',
		answer: 'The answer',
		tip: 'TIP',
		online: 'online',
		typing: 'typing…',
		search: 'Search',
		score: 'How many did you get right?',
		commentScore: 'Tell me in the comments',
		didYouKnow: 'Did you know?',
	},
	ar: {
		myth: 'خرافة',
		fact: 'حقيقة',
		follow: 'تابعني لنصائح صحية أكثر',
		subscribe: 'اشترك',
		disclaimer: 'للتوعية فقط، ولا يغني عن استشارة الطبيب.',
		trueWord: 'صح',
		falseWord: 'غلط',
		quiz: 'اختبار صحي',
		trueOrFalse: 'صح ولا غلط؟',
		answer: 'الإجابة',
		tip: 'نصيحة',
		online: 'متصل الآن',
		typing: 'بيكتب…',
		search: 'ابحث',
		score: 'جاوبت كام صح؟',
		commentScore: 'قولّي في الكومنتات',
		didYouKnow: 'هل تعلم؟',
	},
};

export const formatNumber = (n: number, lang: Lang) =>
	lang === 'ar' ? n.toLocaleString('ar-EG') : String(n);
