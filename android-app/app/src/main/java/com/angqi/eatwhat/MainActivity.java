package com.angqi.eatwhat;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.IOException;

public class MainActivity extends Activity {
    private WebView webView;
    private ValueCallback<android.net.Uri[]> fileCallback;
    private Uri cameraUri;
    private static final int PICK_IMAGE = 1;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        webView.setBackgroundColor(0xfff2f5eb);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<android.net.Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.setType("image/*");
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                Intent chooser = Intent.createChooser(intent, "拍照或选照片");
                try {
                    File directory = new File(getCacheDir(), "photos");
                    if (!directory.exists() && !directory.mkdirs()) throw new IOException("Cannot create photo directory");
                    File photo = File.createTempFile("meal-", ".jpg", directory);
                    cameraUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", photo);
                    Intent camera = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    camera.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    camera.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    if (camera.resolveActivity(getPackageManager()) != null) chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[] { camera });
                } catch (IOException error) { cameraUri = null; }
                startActivityForResult(chooser, PICK_IMAGE);
                return true;
            }
        });
        webView.loadUrl("file:///android_asset/index.html");
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == PICK_IMAGE && fileCallback != null) {
            Uri selected = data != null ? data.getData() : null;
            fileCallback.onReceiveValue(resultCode == RESULT_OK && (selected != null || cameraUri != null)
                ? new Uri[] { selected != null ? selected : cameraUri } : null);
            fileCallback = null;
            cameraUri = null;
        }
    }

    @Override public void onBackPressed() {
        if (webView != null) webView.evaluateJavascript("window.androidBack && window.androidBack()", null);
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) fileCallback.onReceiveValue(null);
        webView.destroy();
        super.onDestroy();
    }
}
