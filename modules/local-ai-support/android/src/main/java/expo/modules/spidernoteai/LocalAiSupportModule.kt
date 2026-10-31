package expo.modules.spidernoteai

import android.app.ActivityManager
import android.content.Context
import android.media.AudioFormat
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import android.os.Build
import android.os.Debug
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.RandomAccessFile
import java.net.URI
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.UUID
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.*

/** App-private, streaming audio preparation. Never overwrites or deletes source audio. */
class LocalAiSupportModule : Module() {
  private val cancelled = AtomicBoolean(false)
  private val preparing = AtomicBoolean(false)
  private val context get() = requireNotNull(appContext.reactContext)
  private fun inside(file: File, root: File) = file.canonicalPath.startsWith(root.canonicalPath + File.separator)
  override fun definition() = ModuleDefinition {
    Name("LocalAiSupport")
    Function("cancelPrepare") { cancelled.set(true) }
    Function("getMemoryStats") {
      val activity = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val info = ActivityManager.MemoryInfo(); activity.getMemoryInfo(info)
      val highWater = File("/proc/self/status").useLines { lines ->
        lines.firstOrNull { it.startsWith("VmHWM:") }?.trim()?.split(Regex("\\s+"))?.getOrNull(1)?.toLongOrNull() ?: 0L
      }
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      mapOf("pssBytes" to Debug.getPss().toDouble() * 1024, "highWaterRssBytes" to highWater.toDouble() * 1024,
        "availableBytes" to info.availMem.toDouble(), "totalBytes" to info.totalMem.toDouble(),
        "thermalStatus" to if (Build.VERSION.SDK_INT >= 29) power.currentThermalStatus else -1)
    }
    Function("removePrepared") { directory: String ->
      val file = File(directory); val root = File(context.cacheDir, "ai-audio")
      require(inside(file, root)) { "Invalid temporary audio path" }
      file.deleteRecursively(); Unit
    }
    AsyncFunction("prepareAudio") { uri: String ->
      require(preparing.compareAndSet(false, true)) { "Audio preparation is already running" }
      cancelled.set(false)
      val directory = File(context.cacheDir, "ai-audio/${UUID.randomUUID()}")
      try {
        val parsed = URI(uri); require(parsed.scheme == "file") { "Only local audio is supported" }
        val input = File(parsed).canonicalFile
        require(inside(input, context.filesDir) || inside(input, context.cacheDir)) { "Audio must be in app-private storage" }
        require(input.exists() && input.length() > 0 && input.length() < 512L * 1024 * 1024) { "Invalid audio file or file too large" }
        require(context.cacheDir.usableSpace > 100L * 1024 * 1024) { "At least 100 MB of free storage is needed for temporary audio" }
        directory.mkdirs()
        val writer = ChunkWriter(directory)
        try { decode(input, writer) } finally { writer.close() }
        require(writer.totalSamples > 0) { "No playable audio was found" }
        mapOf("directory" to directory.absolutePath, "durationMs" to writer.totalSamples * 1000.0 / 16000,
          "segments" to writer.files.mapIndexed { index, item -> mapOf("uri" to Uri.fromFile(item.first).toString(), "offsetMs" to index * 30000, "durationMs" to item.second * 1000.0 / 16000) })
      } catch (error: Throwable) { directory.deleteRecursively(); throw error }
      finally { preparing.set(false) }
    }
  }
  private fun checkCancelled() { check(!cancelled.get()) { "AI task cancelled" } }
  private fun decode(input: File, writer: ChunkWriter) {
    val extractor = MediaExtractor(); var codec: MediaCodec? = null
    try {
      extractor.setDataSource(input.absolutePath)
      val track = (0 until extractor.trackCount).firstOrNull { extractor.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true }
        ?: error("The selected file has no audio track")
      extractor.selectTrack(track); val format = extractor.getTrackFormat(track)
      if (format.containsKey(MediaFormat.KEY_DURATION)) require(format.getLong(MediaFormat.KEY_DURATION) <= 1800L * 1000000) { "Offline AI currently supports recordings up to 30 minutes" }
      var sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      var channels = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      var encoding = if (format.containsKey(MediaFormat.KEY_PCM_ENCODING)) format.getInteger(MediaFormat.KEY_PCM_ENCODING) else AudioFormat.ENCODING_PCM_16BIT
      val resampler = Resampler(writer)
      fun consume(buffer: ByteBuffer) {
        require(channels in 1..8 && sampleRate in 8000..192000) { "Unsupported audio format" }
        require(encoding == AudioFormat.ENCODING_PCM_16BIT || encoding == AudioFormat.ENCODING_PCM_FLOAT) { "Unsupported PCM sample format" }
        buffer.order(ByteOrder.LITTLE_ENDIAN)
        val width = if (encoding == AudioFormat.ENCODING_PCM_FLOAT) 4 else 2
        while (buffer.remaining() >= width * channels) {
          var mono = 0.0
          repeat(channels) { mono += if (encoding == AudioFormat.ENCODING_PCM_FLOAT) buffer.float.toDouble() else buffer.short.toDouble() / 32768.0 }
          resampler.push(mono / channels, sampleRate)
        }
      }
      val mime = requireNotNull(format.getString(MediaFormat.KEY_MIME))
      if (mime == "audio/raw") {
        val buffer = ByteBuffer.allocate(65536)
        while (true) { checkCancelled(); buffer.clear(); val count = extractor.readSampleData(buffer, 0); if (count < 0) break; buffer.position(0); buffer.limit(count); consume(buffer); extractor.advance() }
      } else {
        val decoder = MediaCodec.createDecoderByType(mime); codec = decoder
        format.setInteger(MediaFormat.KEY_PCM_ENCODING, AudioFormat.ENCODING_PCM_16BIT)
        decoder.configure(format, null, null, 0); decoder.start()
        val info = MediaCodec.BufferInfo(); var inputEnded = false; var outputEnded = false
        var lastProgress = System.currentTimeMillis()
        while (!outputEnded) {
          checkCancelled(); require(System.currentTimeMillis() - lastProgress < 30000) { "Audio decoder timed out" }
          if (!inputEnded) {
            val index = decoder.dequeueInputBuffer(10000)
            if (index >= 0) {
              val buffer = requireNotNull(decoder.getInputBuffer(index)); val count = extractor.readSampleData(buffer, 0)
              if (count < 0) { decoder.queueInputBuffer(index, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM); inputEnded = true }
              else { decoder.queueInputBuffer(index, 0, count, extractor.sampleTime, 0); extractor.advance() }
            }
          }
          val index = decoder.dequeueOutputBuffer(info, 10000)
          if (index == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            val output = decoder.outputFormat; sampleRate = output.getInteger(MediaFormat.KEY_SAMPLE_RATE); channels = output.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            encoding = if (output.containsKey(MediaFormat.KEY_PCM_ENCODING)) output.getInteger(MediaFormat.KEY_PCM_ENCODING) else AudioFormat.ENCODING_PCM_16BIT
            require(encoding == AudioFormat.ENCODING_PCM_16BIT || encoding == AudioFormat.ENCODING_PCM_FLOAT) { "Unsupported decoder sample format" }
          } else if (index >= 0) {
            if (info.size > 0) { val buffer = requireNotNull(decoder.getOutputBuffer(index)); buffer.position(info.offset); buffer.limit(info.offset + info.size); consume(buffer); lastProgress = System.currentTimeMillis() }
            outputEnded = info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0; decoder.releaseOutputBuffer(index, false)
          }
        }
      }
    } finally { try { codec?.stop() } catch (_: Exception) {}; codec?.release(); extractor.release() }
  }
  private inner class Resampler(private val writer: ChunkWriter) {
    var index = 0L; var next = 0.0; var previous = 0.0; var low1 = 0.0; var low2 = 0.0
    fun push(value: Double, sampleRate: Int) {
      // Streaming low-pass + linear interpolation; no whole-recording PCM allocation.
      val alpha = 1 - exp(-2 * PI * min(6500.0, sampleRate * .4) / sampleRate)
      low1 += alpha * (value - low1); low2 += alpha * (low1 - low2)
      val current = if (sampleRate == 16000) value else low2
      while (next <= index.toDouble()) {
        val fraction = (next - (index - 1)).coerceIn(0.0, 1.0)
        writer.write(((previous + (current - previous) * fraction) * 32767).roundToInt().coerceIn(-32768, 32767).toShort())
        next += sampleRate / 16000.0
      }
      previous = current; index++
    }
  }
  private inner class ChunkWriter(private val directory: File) {
    val files = mutableListOf<Pair<File, Int>>(); var totalSamples = 0L; var samples = 0
    private var output: RandomAccessFile? = null; private var file: File? = null
    private val buffer = ByteArray(8192); private var buffered = 0
    fun write(value: Short) {
      checkCancelled(); require(totalSamples < 1800L * 16000) { "Offline AI supports at most 30 minutes per recording" }
      if (output == null) { file = File(directory, "${files.size}.wav"); output = RandomAccessFile(file!!, "rw"); output!!.write(ByteArray(44)); samples = 0 }
      buffer[buffered++] = (value.toInt() and 255).toByte(); buffer[buffered++] = (value.toInt() shr 8).toByte()
      if (buffered == buffer.size) flush()
      samples++; totalSamples++; if (samples == 30 * 16000) close()
    }
    private fun flush() { if (buffered > 0) { output!!.write(buffer, 0, buffered); buffered = 0 } }
    fun close() {
      val out = output ?: return
      flush(); val bytes = samples * 2
      val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
      header.put("RIFF".toByteArray()).putInt(36 + bytes).put("WAVEfmt ".toByteArray()).putInt(16).putShort(1.toShort()).putShort(1.toShort()).putInt(16000).putInt(32000).putShort(2.toShort()).putShort(16.toShort()).put("data".toByteArray()).putInt(bytes)
      out.seek(0); out.write(header.array()); out.close(); files.add(Pair(file!!, samples)); output = null
    }
  }
}
