import {bundle} from '@remotion/bundler';
import {renderMedia, selectComposition} from '@remotion/renderer';
import path from 'node:path';
import {renderFileName} from '../src/shared/project';
import {buildVideoProps, propsSignature} from '../src/shared/timeline';
import type {Project, RenderInfo, Settings} from '../src/shared/types';
import {iconBodies} from './icons';
import {PORT, PROD, REMOTION_ENTRY, RENDERS_DIR} from './paths';

let bundled: Promise<string> | null = null;

/** Bundles the video template once per server run (every render in dev, so template edits show up). */
const getServeUrl = () => {
	if (!bundled || !PROD) {
		bundled = bundle({entryPoint: REMOTION_ENTRY}).catch((error) => {
			bundled = null;
			throw error;
		});
	}
	return bundled;
};

export const renderProject = async (
	project: Project,
	settings: Settings,
	onProgress: (p: number) => void,
): Promise<RenderInfo> => {
	// Icon drawings come from the cached icon library; if it can't load, built-in fallbacks are used.
	const icons = await iconBodies(project.scenes.map((s) => s.icon)).catch(() => ({}));
	// Audio and logo are fetched by the headless browser from this server.
	const inputProps = buildVideoProps(project, settings, {mediaBase: `http://localhost:${PORT}`, icons});
	onProgress(0.02);
	const serveUrl = await getServeUrl();
	onProgress(0.08);
	const composition = await selectComposition({serveUrl, id: 'Short', inputProps, chromiumOptions: {disableWebSecurity: true}});
	const fileName = renderFileName(project, 'mp4');
	await renderMedia({
		composition,
		serveUrl,
		// The voice and music are fetched from this server, a different port than the bundle.
		chromiumOptions: {disableWebSecurity: true},
		codec: 'h264',
		crf: 20,
		outputLocation: path.join(RENDERS_DIR, fileName),
		inputProps,
		licenseKey: 'free-license',
		onProgress: ({progress}) => onProgress(0.1 + progress * 0.9),
	});
	return {
		url: `/renders/${encodeURIComponent(fileName)}`,
		fileName,
		createdAt: new Date().toISOString(),
		signature: propsSignature(buildVideoProps(project, settings)),
	};
};
