# 安卓版开发说明

安卓 App 与微信小程序是两个独立应用，界面和功能相近，但清单、记录与照片不会互相同步。底部导航为「选一顿 / 清单 / 记录」。

当前试用安装包：[今天吃什么.apk](今天吃什么.apk)。这是测试签名的 APK，不是应用商店发布包。已有同签名旧版时可覆盖安装以保留本地数据；不要先卸载旧版。

## 从源码构建

使用 Android Studio 打开本目录，安装 Android SDK 35，使用 JDK 17、Gradle 8.9 和 Android Gradle Plugin 8.7.3。若提示缺少 Gradle wrapper，可安装 Gradle 8.9 后在本目录运行 `gradle wrapper --gradle-version 8.9`，再重新同步工程。

在 Android Studio 选择 `Build > Build Bundle(s) / APK(s) > Build APK(s)`。构建输出通常位于 `app/build/outputs/apk/debug/app-debug.apk`。

App 不需要账号或服务器。卸载或清除应用数据会删除本机清单、记录和照片。
