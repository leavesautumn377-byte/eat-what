# iPhone 测试版工程（尚未生成 IPA）

这个 Xcode 工程复用安卓测试版的离线页面、背景、字体和餐签咬痕图标。吃饭清单、随机选择、换一个、拍照/选照片和记录都在包内运行，数据保存在这台 iPhone 上，不会与安卓 App 或微信小程序自动同步。

当前电脑是 Windows，没有 Xcode，也没有此 App 的苹果签名，因此这里**没有可安装的 `.ipa`**。源代码和资源已经准备在 `EatWhat.xcodeproj`，但尚未在 Mac、模拟器或 iPhone 上编译和实测，尤其需要验证相机/相册选择及照片保存。

## 在 Mac 上装到自己的 iPhone

1. 将整个 `ios-app` 文件夹放到 Mac，使用 Xcode 打开 `EatWhat.xcodeproj`。
2. 在项目的 `EatWhat` Target > Signing & Capabilities 选择自己的 Apple Account 对应的 Team，保持 Automatically manage signing。若提示 Bundle Identifier 冲突，改为自己唯一的标识。
3. 连接并信任 iPhone，选择它作为运行设备，点击 Xcode 的 Run。首次运行按 Xcode 提示开启开发者模式。
4. 测试添加吃的、筛选、抽取、换一个、拍照或选照片、保存与重开后记录是否保留。

个人 Apple Account 可用于自己的设备临时测试，但配置文件会过期；要让同学长期方便地安装测试，需加入 Apple Developer Program，用 Xcode Archive 上传 TestFlight。不能把未经签名或与测试设备不匹配的 IPA 当成像 APK 一样的通用安装包分享。

参考：[苹果个人账号设备测试](https://developer.apple.com/help/account/basics/about-your-developer-account/)、[Xcode 分发说明](https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases/)、[TestFlight 说明](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/)。
