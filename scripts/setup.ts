// One-time setup: downloads the caption engine (whisper.cpp), its speech model and the
// headless browser used for rendering. Safe to re-run; finished steps are skipped.
import {ensureBrowser} from '@remotion/renderer';
import {spawnSync} from 'node:child_process';
import {createWriteStream, existsSync} from 'node:fs';
import {rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {ensureDirs, modelPath, TMP_DIR, WHISPER_DIR, WHISPER_MODEL, WHISPER_VERSION} from '../server/paths';
import {loadIconLibrary} from '../server/icons';
import {findWhisperExe} from '../server/whisper';

const download = async (url: string, dest: string) => {
	const res = await fetch(url);
	if (!res.ok || !res.body) {
		throw new Error(`Download failed (${res.status}): ${url}`);
	}
	const total = Number(res.headers.get('content-length') ?? 0);
	let done = 0;
	let lastPrint = 0;
	const body = Readable.fromWeb(res.body as import('node:stream/web').ReadableStream);
	body.on('data', (chunk: Buffer) => {
		done += chunk.length;
		if (Date.now() - lastPrint > 1000) {
			lastPrint = Date.now();
			const mb = (n: number) => (n / 1e6).toFixed(0);
			process.stdout.write(`  ${mb(done)} / ${total ? mb(total) : '?'} MB\r`);
		}
	});
	const part = `${dest}.part`;
	await pipeline(body, createWriteStream(part));
	await rename(part, dest);
	console.log(`  done (${(done / 1e6).toFixed(0)} MB)`);
};

const installWhisper = async () => {
	if (findWhisperExe()) {
		console.log('✓ Caption engine already installed');
		return;
	}
	if (process.platform !== 'win32') {
		console.log(
			`! Automatic caption-engine install is Windows-only. Build whisper.cpp v${WHISPER_VERSION} and put whisper-cli in ${WHISPER_DIR}`,
		);
		return;
	}
	console.log(`• Downloading caption engine (whisper.cpp v${WHISPER_VERSION})`);
	const zip = path.join(TMP_DIR, 'whisper-bin-x64.zip');
	await download(`https://github.com/ggml-org/whisper.cpp/releases/download/v${WHISPER_VERSION}/whisper-bin-x64.zip`, zip);
	const result = spawnSync(
		'powershell.exe',
		['-NoProfile', '-NonInteractive', '-Command', 'Expand-Archive -Force -LiteralPath $env:SRC -DestinationPath $env:DEST'],
		{env: {...process.env, SRC: zip, DEST: WHISPER_DIR}, stdio: 'inherit'},
	);
	await rm(zip, {force: true});
	if (result.status !== 0 || !findWhisperExe()) {
		throw new Error('Could not unpack the caption engine.');
	}
	console.log('✓ Caption engine installed');
};

const installModel = async () => {
	if (existsSync(modelPath())) {
		console.log(`✓ Speech model ${WHISPER_MODEL} already downloaded`);
		return;
	}
	console.log(`• Downloading speech model ${WHISPER_MODEL} (about 575 MB, one time only)`);
	await download(`https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${WHISPER_MODEL}.bin`, modelPath());
	console.log('✓ Speech model ready');
};

ensureDirs();
await installWhisper();
await installModel();
console.log('• Downloading the icon library (Lucide, about 1 MB)');
await loadIconLibrary()
	.then((lib) => console.log(`✓ Icon library ready (${Object.keys(lib.nodes).length} icons)`))
	.catch((e) => console.log(`! Icon library not downloaded yet (${(e as Error).message}); the app will retry when online.`));
console.log('• Checking the video renderer');
await ensureBrowser();
console.log('✓ Video renderer ready');
console.log(`\nAll set. Start the app with "Start Tabeba's workspace.bat" (or npm run dev while developing).`);
