package expo.modules.smartalarm

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class NightWidgetManifestTest {
    /** The full <receiver> element declaring [name], self-closing or not. */
    private fun receiver(name: String): String {
        val xml = File("src/main/AndroidManifest.xml").readText()
        val at = xml.indexOf("android:name=\"expo.modules.smartalarm.$name\"")
        assertTrue("$name not declared", at >= 0)
        val open = xml.lastIndexOf("<receiver", at)
        val openEnd = xml.indexOf(">", at)
        if (xml[openEnd - 1] == '/') return xml.substring(open, openEnd + 1)
        return xml.substring(open, xml.indexOf("</receiver>", at))
    }

    @Test fun providerHandlesAppWidgetUpdate() {
        val block = receiver("NightWidgetProvider")
        assertTrue(block.contains("android.appwidget.action.APPWIDGET_UPDATE"))
        assertTrue(block.contains("android.appwidget.provider"))
        assertTrue(block.contains("@xml/aube_night_widget_info"))
    }

    @Test fun actionReceiverIsNotExported() {
        assertTrue(receiver("NightWidgetActionReceiver").contains("android:exported=\"false\""))
    }
}
