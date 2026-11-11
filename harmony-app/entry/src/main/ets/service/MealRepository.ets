import { common } from '@kit.AbilityKit';
import { fileIo, fileUri } from '@kit.CoreFileKit';
import { MealDatabase, MealRecord, createId, defaultDatabase, parseDatabase } from '../model/MealData';

export class MealRepository {
  private directory: string;
  private databasePath: string;
  private photoDirectory: string;

  constructor(context: common.UIAbilityContext) {
    this.directory = context.filesDir;
    this.databasePath = `${this.directory}/eatwhat-v1.json`;
    this.photoDirectory = `${this.directory}/meal-photos`;
    if (!fileIo.accessSync(this.photoDirectory)) {
      fileIo.mkdirSync(this.photoDirectory);
    }
  }

  load(): MealDatabase {
    if (!fileIo.accessSync(this.databasePath)) {
      const initial: MealDatabase = defaultDatabase();
      this.save(initial);
      return initial;
    }
    return parseDatabase(fileIo.readTextSync(this.databasePath));
  }

  save(database: MealDatabase): void {
    const serialized: string = JSON.stringify(database);
    parseDatabase(serialized);
    const temporary: string = `${this.databasePath}.pending`;
    const file: fileIo.File = fileIo.openSync(temporary,
      fileIo.OpenMode.CREATE | fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.TRUNC);
    try {
      fileIo.writeSync(file.fd, serialized);
      fileIo.fsyncSync(file.fd);
    } finally {
      fileIo.closeSync(file);
    }
    if (fileIo.readTextSync(temporary) !== serialized) {
      throw new Error('数据未完整写入，请检查手机空间后重试');
    }
    // The live database changes only after the complete new file is written.
    fileIo.renameSync(temporary, this.databasePath);
  }

  async importPhoto(uri: string): Promise<string> {
    if (uri.length === 0) {
      return '';
    }
    if (this.isOwnedPhoto(uri)) {
      if (!fileIo.accessSync(uri)) {
        throw new Error('照片文件不存在，请重新选择');
      }
      return uri;
    }
    const path: string = `${this.photoDirectory}/${createId()}.jpg`;
    const source: fileIo.File = await fileIo.open(uri, fileIo.OpenMode.READ_ONLY);
    try {
      await fileIo.copyFile(source.fd, path);
    } catch (error) {
      this.removePhoto(path, []);
      throw error;
    } finally {
      fileIo.closeSync(source);
    }
    return path;
  }

  private isOwnedPhoto(path: string): boolean {
    return path.startsWith(`${this.photoDirectory}/`) && !path.includes('/../');
  }

  removePhoto(path: string, remaining: MealRecord[]): void {
    if (!this.isOwnedPhoto(path) || remaining.some((record: MealRecord) => record.photoPath === path)) {
      return;
    }
    try {
      if (fileIo.accessSync(path)) {
        fileIo.unlinkSync(path);
      }
    } catch (_) {
      // A leftover unreferenced image is safer than rolling back a committed record deletion.
    }
  }

  removePhotos(removed: MealRecord[], remaining: MealRecord[]): void {
    const paths: Set<string> = new Set<string>();
    removed.forEach((record: MealRecord) => paths.add(record.photoPath));
    paths.forEach((path: string) => this.removePhoto(path, remaining));
  }
}

export function photoSource(path: string): string {
  return path.startsWith('/') ? fileUri.getUriFromPath(path) : path;
}
