import { common } from '@kit.AbilityKit';
import { camera, cameraPicker } from '@kit.CameraKit';
import { fileIo, fileUri } from '@kit.CoreFileKit';
import { photoAccessHelper } from '@kit.MediaLibraryKit';
import { createId } from '../model/MealData';

export async function selectAlbumPhoto(): Promise<string> {
  const options: photoAccessHelper.PhotoSelectOptions = new photoAccessHelper.PhotoSelectOptions();
  options.MIMEType = photoAccessHelper.PhotoViewMIMETypes.IMAGE_TYPE;
  options.maxSelectNumber = 1;
  const picker: photoAccessHelper.PhotoViewPicker = new photoAccessHelper.PhotoViewPicker();
  const result: photoAccessHelper.PhotoSelectResult = await picker.select(options);
  return result.photoUris.length > 0 ? result.photoUris[0] : '';
}

export async function takePhoto(context: common.UIAbilityContext): Promise<string> {
  const destination: string = `${context.cacheDir}/meal-camera-${createId()}.jpg`;
  const file: fileIo.File = fileIo.openSync(destination, fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE);
  fileIo.closeSync(file);
  const profile: cameraPicker.PickerProfile = {
    cameraPosition: camera.CameraPosition.CAMERA_POSITION_BACK,
    saveUri: fileUri.getUriFromPath(destination)
  };
  try {
    const result: cameraPicker.PickerResult = await cameraPicker.pick(context,
      [cameraPicker.PickerMediaType.PHOTO], profile);
    if (result.resultCode === 0 && result.resultUri.length > 0) {
      return result.resultUri;
    }
    removeCameraDraft(context, destination);
    return '';
  } catch (error) {
    removeCameraDraft(context, destination);
    throw error;
  }
}

export function removeCameraDraft(context: common.UIAbilityContext, path: string): void {
  const prefix: string = `${context.cacheDir}/meal-camera-`;
  const localPath: string = path.startsWith('file:') ? new fileUri.FileUri(path).path : path;
  if (!localPath.startsWith(prefix) || localPath.includes('/../')) {
    return;
  }
  try {
    if (fileIo.accessSync(localPath)) {
      fileIo.unlinkSync(localPath);
    }
  } catch (_) {
    // Cache cleanup does not change a successfully saved meal record.
  }
}
