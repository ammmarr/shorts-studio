import {canRenderMediaOnWeb, renderMediaOnWeb} from '@remotion/web-renderer';
import {ShortVideo} from '../../remotion/ShortVideo';
import {durationInFrames, FPS, HEIGHT, WIDTH} from '../../shared/timeline';
import type {VideoProps} from '../../shared/types';

export type DeviceRender = {blob: Blob; extension: 'mp4' | 'webm'; mimeType: string};

/**
 * Makes the finished video on this device, with the same template the preview uses. MP4 (H.264)
 * when the phone can encode it, which YouTube and WhatsApp prefer; WebM otherwise.
 */
export const renderOnDevice = async (props: VideoProps, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<DeviceRender> => {
	const mp4 = await canRenderMediaOnWeb({container: 'mp4', videoCodec: 'h264', width: WIDTH, height: HEIGHT});
	const container = mp4.canRender ? 'mp4' : 'webm';
	const result = await renderMediaOnWeb({
		composition: {component: ShortVideo, id: 'Short', width: WIDTH, height: HEIGHT, fps: FPS, durationInFrames: durationInFrames(props), defaultProps: props},
		inputProps: props,
		container,
		videoCodec: container === 'mp4' ? 'h264' : 'vp9',
		videoBitrate: 'high',
		hardwareAcceleration: 'prefer-hardware',
		onProgress: (p) => onProgress(p.progress),
		signal: signal ?? null,
		licenseKey: 'free-license',
	});
	const blob = await result.getBlob();
	return {blob, extension: container, mimeType: container === 'mp4' ? 'video/mp4' : 'video/webm'};
};
