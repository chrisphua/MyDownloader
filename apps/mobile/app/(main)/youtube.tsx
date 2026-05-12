import { useMemo, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/context/ThemeContext";
import type { AppColors } from "@/theme";
import { env } from "@/config/env";

type Format = "mp3" | "mp4";
type Resolution = "best" | "1080" | "720" | "480";
type Phase = "idle" | "starting" | "downloading" | "processing" | "done" | "error";

interface ProgressInfo {
  percent: number;
  speed: string;
  eta: string;
}

function makeStyles(c: AppColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    container: { flex: 1, padding: 20, gap: 16 },
    label: { color: c.textSecondary, fontSize: 12, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
    input: {
      backgroundColor: c.surface,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
      fontSize: 15,
      color: c.text,
    },
    row: { flexDirection: "row", gap: 8 },
    chip: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: "center", backgroundColor: c.surfaceAlt },
    chipActive: { backgroundColor: c.accent },
    chipText: { fontSize: 14, fontWeight: "500", color: c.textSecondary },
    chipTextActive: { color: "#fff" },
    btn: {
      marginTop: 8,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: c.accent,
    },
    btnDisabled: { opacity: 0.4 },
    btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    section: { gap: 8 },

    progressBox: { gap: 6 },
    track: { height: 6, borderRadius: 3, backgroundColor: c.surfaceAlt, overflow: "hidden" },
    fill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
    progressRow: { flexDirection: "row", justifyContent: "space-between" },
    progressPct: { fontSize: 13, fontWeight: "600", color: c.text },
    progressMeta: { fontSize: 13, color: c.textSecondary },

    statusText: { color: c.textSecondary, textAlign: "center", fontSize: 14 },
    errorText: { color: c.danger, textAlign: "center", fontSize: 14 },
    successText: { color: c.accent, textAlign: "center", fontSize: 14, fontWeight: "600" },
  });
}

export default function YouTubeScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("mp3");
  const [resolution, setResolution] = useState<Resolution>("best");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<ProgressInfo>({ percent: 0, speed: "", eta: "" });
  const [errorMsg, setErrorMsg] = useState("");
  const animWidth = useRef(new Animated.Value(0)).current;
  const esRef = useRef<EventSource | null>(null);

  const busy = phase === "starting" || phase === "downloading" || phase === "processing";
  const canDownload = url.trim().length > 0 && !busy;

  function animateTo(pct: number) {
    Animated.timing(animWidth, { toValue: pct, duration: 300, useNativeDriver: false }).start();
  }

  function reset() {
    esRef.current?.close();
    esRef.current = null;
    setPhase("idle");
    setProgress({ percent: 0, speed: "", eta: "" });
    setErrorMsg("");
    animateTo(0);
  }

  async function handleDownload() {
    if (!canDownload) return;
    reset();
    setPhase("starting");

    const body = { url: url.trim(), format, resolution: resolution === "best" ? "" : resolution };
    const startRes = await fetch(`${env.API_URL}/youtube/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);

    if (!startRes?.ok) {
      setPhase("error");
      setErrorMsg("Failed to start download");
      return;
    }

    const { jobId } = (await startRes.json()) as { jobId: string };
    setPhase("downloading");

    if (Platform.OS !== "web") {
      // EventSource is web-only; on native just poll until done then open URL
      pollUntilDone(jobId);
      return;
    }

    const es = new EventSource(`${env.API_URL}/youtube/progress/${jobId}`);
    esRef.current = es;

    es.addEventListener("progress", (e) => {
      const data = JSON.parse((e as MessageEvent).data) as { percent: number; speed: string; eta: string };
      const pct = Math.min(data.percent, 100);
      setProgress({ percent: pct, speed: data.speed, eta: data.eta });
      setPhase(data.eta === "Processing…" ? "processing" : "downloading");
      animateTo(pct);
    });

    es.addEventListener("done", () => {
      es.close();
      animateTo(100);
      setProgress((p) => ({ ...p, percent: 100 }));
      setPhase("done");
      triggerDownload(jobId);
    });

    es.addEventListener("error", (e) => {
      es.close();
      const msg = (e as MessageEvent).data
        ? (JSON.parse((e as MessageEvent).data) as { message: string }).message
        : "Download failed";
      setPhase("error");
      setErrorMsg(msg);
    });
  }

  async function pollUntilDone(jobId: string) {
    // Minimal native path: just wait, no granular progress
    const fileUrl = `${env.API_URL}/youtube/file/${jobId}`;
    // Poll progress endpoint via fetch (SSE not available on native)
    for (let i = 0; i < 360; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      const check = await fetch(`${env.API_URL}/youtube/progress/${jobId}`).catch(() => null);
      if (!check) continue;
      // If the server closed quickly it means it's done
      if (check.headers.get("content-type")?.includes("application/json")) {
        const data = (await check.json()) as { message?: string };
        if (data.message) { setPhase("error"); setErrorMsg(data.message); return; }
      }
      // Try fetching the file — 200 means ready
      const fileCheck = await fetch(fileUrl, { method: "HEAD" }).catch(() => null);
      if (fileCheck?.ok) {
        setPhase("done");
        animateTo(100);
        const { Linking } = await import("react-native");
        await Linking.openURL(fileUrl);
        return;
      }
    }
    setPhase("error");
    setErrorMsg("Timed out waiting for download");
  }

  function triggerDownload(jobId: string) {
    const a = document.createElement("a");
    a.href = `${env.API_URL}/youtube/file/${jobId}`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const trackWidth = animWidth.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] });

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <View style={styles.container}>
        <View style={styles.section}>
          <Text style={styles.label}>YouTube URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://youtube.com/watch?v=..."
            placeholderTextColor={colors.textMuted}
            value={url}
            onChangeText={(v) => { setUrl(v); if (phase !== "idle") reset(); }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Format</Text>
          <View style={styles.row}>
            {(["mp3", "mp4"] as Format[]).map((f) => (
              <Pressable key={f} style={[styles.chip, format === f && styles.chipActive]} onPress={() => setFormat(f)}>
                <Text style={[styles.chipText, format === f && styles.chipTextActive]}>{f.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {format === "mp4" && (
          <View style={styles.section}>
            <Text style={styles.label}>Resolution</Text>
            <View style={styles.row}>
              {(["best", "1080", "720", "480"] as Resolution[]).map((r) => (
                <Pressable key={r} style={[styles.chip, resolution === r && styles.chipActive]} onPress={() => setResolution(r)}>
                  <Text style={[styles.chipText, resolution === r && styles.chipTextActive]}>
                    {r === "best" ? "Best" : `${r}p`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        <Pressable
          style={[styles.btn, !canDownload && styles.btnDisabled]}
          onPress={() => void handleDownload()}
          disabled={!canDownload}
        >
          <Text style={styles.btnText}>
            {phase === "starting" ? "Starting…" : "Download"}
          </Text>
        </Pressable>

        {(busy || phase === "done") && (
          <View style={styles.progressBox}>
            <View style={styles.track}>
              <Animated.View style={[styles.fill, { width: trackWidth }]} />
            </View>
            <View style={styles.progressRow}>
              <Text style={styles.progressPct}>
                {phase === "processing" ? "Processing…" : `${Math.round(progress.percent)}%`}
              </Text>
              {progress.speed ? (
                <Text style={styles.progressMeta}>
                  {phase === "processing" ? "" : `${progress.speed}  ETA ${progress.eta}`}
                </Text>
              ) : null}
            </View>
          </View>
        )}

        {phase === "done" && <Text style={styles.successText}>Done! Check your downloads folder.</Text>}
        {phase === "error" && <Text style={styles.errorText}>{errorMsg}</Text>}
      </View>
    </SafeAreaView>
  );
}
