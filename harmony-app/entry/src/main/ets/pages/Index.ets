import { common } from '@kit.AbilityKit';
import { font } from '@kit.ArkUI';
import { BusinessError } from '@kit.BasicServicesKit';
import { Meal, MealRecord, MealDatabase, MEAL_TIMES, MEAL_TAGS, RATINGS,
  filterMeals, pickMeal, toggleValue, makeMeal, makeRecord, nextDatabase, summarize } from '../model/MealData';
import { MealRepository, photoSource } from '../service/MealRepository';
import { selectAlbumPhoto, takePhoto, removeCameraDraft } from '../service/PhotoService';

@Entry
@Component
struct Index {
  @State tab: string = 'pick';
  @State page: string = '';
  @State meals: Meal[] = [];
  @State records: MealRecord[] = [];
  @State selectedTime: string = '';
  @State selectedTags: string[] = [];
  @State resultId: string = '';
  @State formId: string = '';
  @State formName: string = '';
  @State formLocation: string = '';
  @State formTimes: string[] = [];
  @State formTags: string[] = [];
  @State rating: string = '';
  @State note: string = '';
  @State draftUri: string = '';
  @State previewUri: string = '';
  @State busy: boolean = false;
  @State loadError: string = '';
  private repository?: MealRepository;
  private hostContext?: common.UIAbilityContext;
  private savedDraft: string = '';
  private scroller: Scroller = new Scroller();

  aboutToAppear(): void {
    this.hostContext = this.getUIContext().getHostContext() as common.UIAbilityContext;
    font.registerFont({ familyName: 'MealWenKai', familySrc: $rawfile('wenkai-ui.ttf') });
    this.loadData();
  }

  aboutToDisappear(): void {
    this.releaseDraft();
  }

  onBackPress(): boolean {
    if (this.previewUri.length > 0) { this.previewUri = ''; return true; }
    if (this.busy) { return true; }
    if (this.page.length > 0) { this.back(); return true; }
    if (this.tab !== 'pick') { this.changeTab('pick'); return true; }
    return false;
  }

  private loadData(): void {
    try {
      if (!this.hostContext) { throw new Error('暂时无法取得应用上下文'); }
      this.repository = new MealRepository(this.hostContext);
      const data: MealDatabase = this.repository.load();
      this.meals = data.meals;
      this.records = data.records;
      this.loadError = '';
    } catch (_) {
      this.loadError = '本地数据读取失败。请保留应用数据，重试或联系开发者。';
    }
  }

  private notify(message: string): void {
    this.getUIContext().getPromptAction().showToast({ message: message, duration: 2500 });
  }

  private scrollTop(): void {
    this.scroller.scrollTo({ xOffset: 0, yOffset: 0 });
  }

  private releaseDraft(): void {
    if (this.savedDraft.length > 0 && this.repository) {
      this.repository.removePhoto(this.savedDraft, this.records);
    }
    if (this.hostContext && this.draftUri.length > 0) {
      removeCameraDraft(this.hostContext, this.draftUri);
    }
    this.savedDraft = '';
    this.draftUri = '';
  }

  private clearResult(): void {
    this.releaseDraft();
    this.resultId = '';
    this.rating = '';
    this.note = '';
    this.page = '';
  }

  private currentMeal(): Meal {
    const meal: Meal | undefined = this.meals.find((item: Meal) => item.id === this.resultId);
    return meal ? meal : new Meal();
  }

  private candidates(): Meal[] {
    return filterMeals(this.meals, this.selectedTime, this.selectedTags);
  }

  private changeTab(value: string): void {
    if (this.busy) { return; }
    this.releaseDraft();
    this.page = '';
    this.tab = value;
    this.scrollTop();
  }

  private back(): void {
    if (this.busy) { return; }
    if (this.page === 'recordForm') {
      this.releaseDraft();
      this.rating = '';
      this.note = '';
      this.page = 'result';
    } else {
      this.page = '';
    }
    this.scrollTop();
  }

  private chooseMeal(): void {
    if (this.busy) { return; }
    const selected: Meal | undefined = pickMeal(this.candidates(), this.resultId);
    if (!selected) {
      this.notify(this.resultId.length > 0 ? '只有这一样，试试放宽筛选' : '先添加吃的，或少选一个标签吧');
      return;
    }
    this.releaseDraft();
    this.rating = '';
    this.note = '';
    this.resultId = selected.id;
    this.page = 'result';
    this.scrollTop();
  }

  private editMeal(meal?: Meal): void {
    if (this.busy) { return; }
    this.formId = meal ? meal.id : '';
    this.formName = meal ? meal.name : '';
    this.formLocation = meal ? meal.location : '';
    this.formTimes = meal ? meal.mealTimes.slice() : [];
    this.formTags = meal ? meal.tags.filter((tag: string) => MEAL_TAGS.includes(tag)) : [];
    this.page = 'mealForm';
    this.scrollTop();
  }

  private saveMeal(): void {
    if (this.busy || !this.repository) { return; }
    this.busy = true;
    try {
      const meal: Meal = makeMeal(this.formName, this.formLocation, this.formTimes, this.formTags, this.formId);
      const next: Meal[] = this.formId.length > 0 ?
        this.meals.map((item: Meal) => item.id === this.formId ? meal : item) : [meal].concat(this.meals);
      this.repository.save(nextDatabase(next, this.records));
      this.meals = next;
      this.clearResult();
      this.tab = 'list';
      this.scrollTop();
      this.notify('已保存');
    } catch (error) {
      const message: string = (error as Error).message;
      this.notify(message === '先写一个名称' || message === '名称最多40字，店名最多50字' ? message : '保存失败，请检查手机空间后重试');
    } finally {
      this.busy = false;
    }
  }

  private async choosePhoto(): Promise<void> {
    if (this.busy || !this.hostContext) { return; }
    this.busy = true;
    let choice: number = -1;
    try {
      const result = await this.getUIContext().getPromptAction().showActionMenu({
        title: '记录这一顿', buttons: [{ text: '拍照', color: '#355d49' }, { text: '从相册选择', color: '#355d49' }]
      });
      choice = result.index;
    } catch (_) {
      this.busy = false;
      return;
    }
    try {
      const uri: string = choice === 0 ? await takePhoto(this.hostContext) : await selectAlbumPhoto();
      if (uri.length > 0) {
        this.releaseDraft();
        this.draftUri = uri;
      }
    } catch (_) {
      this.notify('暂时无法取得照片，请重试或换一张照片');
    } finally {
      this.busy = false;
    }
  }

  private async saveRecord(): Promise<void> {
    if (this.busy || !this.repository || this.resultId.length === 0) { return; }
    this.busy = true;
    try {
      const meal: Meal = this.currentMeal();
      if (meal.id.length === 0) { throw new Error('餐食已不存在'); }
      if (this.draftUri.length > 0 && this.savedDraft.length === 0) {
        this.savedDraft = await this.repository.importPhoto(this.draftUri);
      }
      const record: MealRecord = makeRecord(meal, this.selectedTime, this.rating, this.note, this.savedDraft);
      const next: MealRecord[] = [record].concat(this.records);
      this.repository.save(nextDatabase(this.meals, next));
      this.records = next;
      this.savedDraft = '';
      this.clearResult();
      this.tab = 'records';
      this.scrollTop();
      this.notify('已经记下来了');
    } catch (_) {
      this.notify('保存失败，内容已保留。请检查手机空间，或移除照片后重试');
    } finally {
      this.busy = false;
    }
  }

  private async confirmDelete(kind: string, id: string = ''): Promise<void> {
    if (this.busy || !this.repository) { return; }
    this.busy = true;
    try {
      const result = await this.getUIContext().getPromptAction().showDialog({
        title: kind === 'all' ? '清空全部记录？' : kind === 'meal' ? '删除这份吃的？' : '删除这条记录？',
        message: kind === 'meal' ? '将从清单移除，以前的吃饭记录会保留。' : '记录和对应照片会从当前设备移除。',
        buttons: [{ text: '取消', color: '#688572' }, { text: '删除', color: '#c87972' }]
      });
      if (result.index !== 1) { return; }
      if (kind === 'meal') {
        const next: Meal[] = this.meals.filter((meal: Meal) => meal.id !== id);
        this.repository.save(nextDatabase(next, this.records));
        this.meals = next;
        if (this.resultId === id) { this.clearResult(); }
      } else {
        const remaining: MealRecord[] = kind === 'all' ? [] : this.records.filter((record: MealRecord) => record.id !== id);
        const removed: MealRecord[] = this.records.filter((record: MealRecord) => !remaining.some((item: MealRecord) => item.id === record.id));
        this.repository.save(nextDatabase(this.meals, remaining));
        this.records = remaining;
        this.repository.removePhotos(removed, remaining);
      }
      this.notify(kind === 'all' ? '已清空' : '已删除');
    } catch (error) {
      const detail: BusinessError = error as BusinessError;
      if (detail.code !== 100001) { this.notify('删除没有完成，请重试'); }
    } finally {
      this.busy = false;
    }
  }

  @Builder
  private heading(text: string, large: boolean = false) {
    Text(text).fontFamily('MealWenKai').fontSize(large ? 36 : 24).fontColor('#355d49')
      .width('100%').margin({ top: 8, bottom: 16 });
  }

  @Builder
  private hint(text: string) {
    Text(text).fontFamily('MealWenKai').fontSize(15).fontColor('#688572').lineHeight(24)
      .width('100%').margin({ top: 12, bottom: 12 });
  }

  @Builder
  private action(text: string, handler: () => void, primary: boolean = false) {
    Button(text, { type: ButtonType.Normal }).fontFamily('MealWenKai').fontSize(primary ? 23 : 18)
      .fontColor('#355d49').backgroundColor(primary ? '#D9BFD9C3' : '#C9E2EEE0')
      .borderRadius(0).borderWidth({ bottom: primary ? 2 : 1 }).borderColor('#8caf94')
      .padding({ left: 16, right: 16, top: 12, bottom: 12 }).constraintSize({ minHeight: 48 })
      .width('100%').enabled(!this.busy).onClick(handler).margin({ top: 8, bottom: 8 });
  }

  @Builder
  private chip(text: string, active: boolean, handler: () => void) {
    Button(text, { type: ButtonType.Normal }).fontFamily('MealWenKai').fontSize(17)
      .fontColor('#426b50').backgroundColor(active ? '#B0CFE3CF' : Color.Transparent)
      .borderRadius(0).borderWidth({ bottom: active ? 1 : 0 }).borderColor('#92ad98')
      .padding({ left: 10, right: 10 }).height(44).margin({ right: 8, bottom: 7 })
      .enabled(!this.busy).onClick(handler);
  }

  @Builder
  private mealTags(values: string[]) {
    Flex({ wrap: FlexWrap.Wrap }) {
      ForEach(values, (value: string) => {
        Text(value).fontFamily('MealWenKai').fontSize(14).fontColor('#688572')
          .margin({ right: 12, bottom: 6 });
      }, (value: string) => value);
    }.width('100%');
  }

  @Builder
  private pickPage() {
    Column() {
      Text('今天吃什么').fontFamily('MealWenKai').fontSize(18).fontColor('#587862').width('100%');
      Blank().height(350);
    }.width('100%');
    this.heading('时段');
    Flex({ wrap: FlexWrap.Wrap }) {
      ForEach(['全部'].concat(MEAL_TIMES), (time: string) => {
        this.chip(time, (this.selectedTime || '全部') === time, () => {
          this.clearResult(); this.selectedTime = time === '全部' ? '' : time;
        });
      }, (time: string) => time);
    }.width('100%');
    Row() {
      Text('口味').fontFamily('MealWenKai').fontSize(24).fontColor('#355d49');
      Blank();
      if (this.selectedTags.length > 0) {
        Button('清除', { type: ButtonType.Normal }).fontFamily('MealWenKai').fontColor('#688572')
          .backgroundColor(Color.Transparent).enabled(!this.busy)
          .onClick(() => { this.clearResult(); this.selectedTags = []; });
      }
    }.width('100%').margin({ top: 18, bottom: 12 });
    Flex({ wrap: FlexWrap.Wrap }) {
      ForEach(MEAL_TAGS, (tag: string) => {
        this.chip(tag, this.selectedTags.includes(tag), () => {
          this.clearResult(); this.selectedTags = toggleValue(this.selectedTags, tag);
        });
      }, (tag: string) => tag);
    }.width('100%');
    this.hint(`可选 ${this.candidates().length} 样`);
    this.action('抽一顿', () => this.chooseMeal(), true);
    if (this.candidates().length === 0) {
      this.hint(this.meals.length === 0 ? '清单还是空的，先加几样平常吃的吧。' : '还没有符合这些感觉的吃的，少选一个，或去清单补标签。');
      if (this.meals.length === 0) { this.action('去添加', () => { this.tab = 'list'; this.editMeal(); }); }
    }
    if (this.records.length > 0) {
      this.heading('最近记录');
      ForEach(this.records.slice(0, 3), (record: MealRecord) => { this.recordCard(record, true); }, (record: MealRecord) => record.id);
    }
  }

  @Builder
  private resultPage() {
    this.hint('这一顿，交给它');
    this.heading('抽到了', true);
    Text(this.currentMeal().name).fontFamily('MealWenKai').fontSize(44).fontColor('#355d49')
      .width('100%').margin({ top: 30, bottom: 14 });
    if (this.currentMeal().location.length > 0) { this.hint(this.currentMeal().location); }
    this.mealTags(this.currentMeal().mealTimes.concat(this.currentMeal().tags));
    this.action('换一个', () => this.chooseMeal());
    this.action('记这一顿', () => { this.page = 'recordForm'; this.scrollTop(); }, true);
  }

  @Builder
  private recordFormPage() {
    this.hint(this.currentMeal().name);
    this.heading('记录这一顿', true);
    this.hint('照片、评价、想法都可以跳过。');
    this.heading('照片');
    if (this.draftUri.length > 0) {
      Image(photoSource(this.draftUri)).width('100%').height(230).objectFit(ImageFit.Contain).borderRadius(10)
        .onClick(() => { this.previewUri = photoSource(this.draftUri); });
      this.action('换一张', () => { this.choosePhoto(); });
      this.action('不要这张', () => this.releaseDraft());
    } else {
      this.action('拍照或选照片', () => { this.choosePhoto(); });
    }
    this.heading('评价');
    Flex({ wrap: FlexWrap.Wrap }) {
      ForEach(RATINGS, (value: string) => {
        this.chip(value, this.rating === value, () => { this.rating = this.rating === value ? '' : value; });
      }, (value: string) => value);
    }.width('100%');
    this.heading('想法');
    TextArea({ text: this.note, placeholder: '这顿怎么样？' }).fontFamily('MealWenKai').fontSize(20)
      .fontColor('#355d49').backgroundColor('#D8FCFDF8').height(120).maxLength(200)
      .enabled(!this.busy).onChange((value: string) => { this.note = value; });
    this.action(this.busy ? '正在处理…' : '保存记录', () => { this.saveRecord(); }, true);
  }

  @Builder
  private mealFormPage() {
    this.heading(this.formId.length > 0 ? '修改吃的' : '添加吃的', true);
    this.heading('吃什么');
    TextInput({ text: this.formName, placeholder: '比如：番茄牛肉饭' }).fontFamily('MealWenKai')
      .fontSize(20).fontColor('#355d49').backgroundColor('#D8FCFDF8').maxLength(40).height(52)
      .enabled(!this.busy).onChange((value: string) => { this.formName = value; });
    this.heading('店名 / 食堂名（选填）');
    TextInput({ text: this.formLocation, placeholder: '在哪里吃' }).fontFamily('MealWenKai')
      .fontSize(20).fontColor('#355d49').backgroundColor('#D8FCFDF8').maxLength(50).height(52)
      .enabled(!this.busy).onChange((value: string) => { this.formLocation = value; });
    this.heading('时段');
    this.hint('可多选，不选则不限时段');
    Flex({ wrap: FlexWrap.Wrap }) {
      ForEach(MEAL_TIMES, (time: string) => {
        this.chip(time, this.formTimes.includes(time), () => { this.formTimes = toggleValue(this.formTimes, time); });
      }, (time: string) => time);
    }.width('100%');
    this.heading('标签（可多选）');
    Flex({ wrap: FlexWrap.Wrap }) {
      ForEach(MEAL_TAGS, (tag: string) => {
        this.chip(tag, this.formTags.includes(tag), () => { this.formTags = toggleValue(this.formTags, tag); });
      }, (tag: string) => tag);
    }.width('100%');
    this.action('保存', () => this.saveMeal(), true);
    this.action('取消', () => this.back());
  }

  @Builder
  private listPage() {
    this.heading('餐食清单', true);
    this.hint(`${this.meals.length} 样吃的`);
    this.action('添加吃的', () => this.editMeal(), true);
    if (this.meals.length === 0) { this.hint('清单是空的，先添加几样你平常吃的吧。'); }
    ForEach(this.meals, (meal: Meal) => {
      Column() {
        Text(meal.name).fontFamily('MealWenKai').fontSize(26).fontColor('#355d49').width('100%');
        if (meal.location.length > 0) { this.hint(meal.location); }
        this.mealTags(meal.mealTimes.concat(meal.tags));
        Row({ space: 12 }) {
          Button('修改', { type: ButtonType.Normal }).fontFamily('MealWenKai').fontColor('#355d49')
            .backgroundColor('#BCE2EEE0').height(44).layoutWeight(1).enabled(!this.busy)
            .onClick(() => this.editMeal(meal));
          Button('删除', { type: ButtonType.Normal }).fontFamily('MealWenKai').fontColor('#c87972')
            .backgroundColor(Color.Transparent).height(44).layoutWeight(1).enabled(!this.busy)
            .onClick(() => { this.confirmDelete('meal', meal.id); });
        }.width('100%').margin({ top: 10 });
      }.width('100%').padding({ top: 20, bottom: 20 }).borderWidth({ bottom: 1 }).borderColor('#8091B29B');
    }, (meal: Meal) => meal.id);
  }

  @Builder
  private recordCard(record: MealRecord, compact: boolean = false) {
    Column() {
      Text(record.mealName).fontFamily('MealWenKai').fontSize(25).fontColor('#355d49').width('100%');
      this.hint(`${record.location || record.source} / ${record.dateText} ${record.timeText}`);
      this.mealTags(record.tags);
      if (record.photoPath.length > 0) {
        Image(photoSource(record.photoPath)).width('100%').height(compact ? 150 : 240)
          .objectFit(ImageFit.Contain).borderRadius(10)
          .onClick(() => { this.previewUri = photoSource(record.photoPath); });
      }
      if (record.rating.length > 0) { this.hint(record.rating); }
      if (record.note.length > 0) {
        Text(record.note).fontFamily('MealWenKai').fontSize(18).fontColor('#355d49').width('100%').margin({ top: 10 });
      }
      if (!compact) { this.action('删除这条', () => { this.confirmDelete('record', record.id); }); }
    }.width('100%').padding({ top: 20, bottom: 20 }).borderWidth({ bottom: 1 }).borderColor('#8091B29B');
  }

  @Builder
  private recordsPage() {
    this.heading('用餐记录', true);
    this.hint('吃过的，都记在这里。');
    this.hint(`已记录 ${this.records.length} 顿　最常选的 ${summarize(this.records).favoriteName}`);
    if (this.records.length > 0) {
      this.hint(`共 ${summarize(this.records).favoriteCount} 次`);
    }
    if (this.records.length > 0) {
      this.action('清空记录', () => { this.confirmDelete('all'); });
      ForEach(this.records, (record: MealRecord) => { this.recordCard(record); }, (record: MealRecord) => record.id);
    } else {
      this.hint('还没有记录，先去选一顿吧。');
      this.action('去选一顿', () => this.changeTab('pick'));
    }
    this.hint('记录和照片只保存在当前设备，不会同步给其他人。卸载或清除应用数据会丢失记录。');
  }

  @Builder
  private tabButton(label: string, value: string) {
    Button(label, { type: ButtonType.Normal }).fontFamily('MealWenKai').fontSize(17)
      .fontColor(this.tab === value ? '#c87972' : '#668b71').backgroundColor(Color.Transparent)
      .borderRadius(0).borderWidth({ bottom: this.tab === value ? 2 : 0 }).borderColor('#c98780')
      .height(60).layoutWeight(1).enabled(!this.busy).onClick(() => this.changeTab(value));
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      Image($r('app.media.watercolor_home')).width('100%').height('100%').objectFit(ImageFit.Cover);
      if (this.tab !== 'pick' || this.page.length > 0 || this.loadError.length > 0) {
        Column().width('100%').height('100%').backgroundColor('#E3F6F8F0');
      }
      Column() {
        Scroll(this.scroller) {
          Column() {
            if (this.loadError.length > 0) {
              this.heading('暂时无法读取记录', true);
              this.hint(this.loadError);
              this.action('重试读取', () => this.loadData());
            } else {
              if (this.page.length > 0) {
                this.action('‹ 返回', () => this.back());
              }
              if (this.page === 'result') { this.resultPage(); }
              else if (this.page === 'recordForm') { this.recordFormPage(); }
              else if (this.page === 'mealForm') { this.mealFormPage(); }
              else if (this.tab === 'pick') { this.pickPage(); }
              else if (this.tab === 'list') { this.listPage(); }
              else { this.recordsPage(); }
            }
          }.width('100%').constraintSize({ maxWidth: 560 }).padding({ left: 24, right: 24, top: 22, bottom: 24 });
        }.width('100%').layoutWeight(1).align(Alignment.Top).scrollBar(BarState.Auto);
        if (this.loadError.length === 0) {
          Row() {
            this.tabButton('选一顿', 'pick');
            this.tabButton('清单', 'list');
            this.tabButton('记录', 'records');
          }.width('100%').backgroundColor('#F0F5F8F0').borderWidth({ top: 1 }).borderColor('#8AAABFAF');
        }
      }.width('100%').height('100%');
      if (this.previewUri.length > 0) {
        Column() {
          Row() {
            Blank();
            Button('关闭', { type: ButtonType.Normal }).fontColor(Color.White).backgroundColor(Color.Transparent)
              .height(50).onClick(() => { this.previewUri = ''; });
          }.width('100%');
          Image(this.previewUri).width('100%').layoutWeight(1).objectFit(ImageFit.Contain);
          Text('轻点照片关闭预览').fontColor('#dddddd').fontSize(14).margin(16);
        }.width('100%').height('100%').backgroundColor('#F5000000')
          .onClick(() => { this.previewUri = ''; });
      }
    }.width('100%').height('100%').backgroundColor('#f2f5eb');
  }
}
