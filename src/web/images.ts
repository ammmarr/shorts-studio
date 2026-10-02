/**
 * Shrinks a photo from the phone's camera (often 4000px and several MB) to what a 1080px wide
 * video needs, so it uploads quickly over Wi-Fi. Keeps the original if the browser can't read it.
 */
export const shrinkImage = async (file: File, maxSide = 1280): Promise<File> => {
	try {
		const bitmap = await createImageBitmap(file);
		const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(bitmap.width * scale);
		canvas.height = Math.round(bitmap.height * scale);
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.86));
		return blob ? new File([blob], 'photo.jpg', {type: 'image/jpeg'}) : file;
	} catch {
		return file;
	}
};
