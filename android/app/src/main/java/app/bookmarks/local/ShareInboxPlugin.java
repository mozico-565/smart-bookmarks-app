package app.bookmarks.local;

import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {
    @Override protected void handleOnNewIntent(Intent intent) {
        getActivity().setIntent(intent);
        notifyListeners("incoming", new JSObject(), true);
    }
    @PluginMethod public void take(PluginCall call) {
        Intent intent = getActivity().getIntent();
        JSObject result = new JSObject();
        if (!Intent.ACTION_SEND.equals(intent.getAction())) { call.resolve(result); return; }
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        String title = intent.getStringExtra(Intent.EXTRA_SUBJECT);
        result.put("text", text == null ? "" : text);
        result.put("title", title == null ? "" : title);
        Uri uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (uri != null && "content".equals(uri.getScheme())) {
            try (InputStream in = getContext().getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int count; int size = 0;
                while (in != null && (count = in.read(buffer)) != -1) {
                    size += count;
                    if (size > 20 * 1024 * 1024) throw new IllegalArgumentException("Shared files must be smaller than 20 MB.");
                    out.write(buffer, 0, count);
                }
                String type = getContext().getContentResolver().getType(uri);
                result.put("type", type == null ? "application/octet-stream" : type);
                result.put("base64", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
                result.put("name", "Shared " + (type != null && type.startsWith("image/") ? "image" : "file"));
            } catch (Exception e) { result.put("error", "Could not read this attachment. Choose a file smaller than 20 MB."); }
        }
        intent.setAction(Intent.ACTION_MAIN);
        intent.removeExtra(Intent.EXTRA_STREAM);
        intent.removeExtra(Intent.EXTRA_TEXT);
        call.resolve(result);
    }
}
