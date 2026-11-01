import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import { useKeepAwake } from "expo-keep-awake";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import {
  runBenchmark,
  type BenchmarkReport,
} from "@/features/ai/benchmark-runner";
import { useAiStatus } from "@/features/ai/status";
import { AiProgress } from "@/components/AiProgress";
import { Button, Chip, Header, Notice, Screen } from "@/components/kit";
import { C, ui } from "@/theme/tokens";
import { errorMessage } from "@/utils/format";
import { reportAiIssue } from "@/services/feedback";

export default function Benchmark() {
  useKeepAwake();
  const db = useSQLiteContext();
  const status = useAiStatus();
  const [repeats, setRepeats] = useState(1);
  const [error, setError] = useState("");
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [imported, setImported] = useState<string>();
  const [reference, setReference] = useState("");
  const run = async () => {
    setError("");
    try {
      setReport(
        await runBenchmark(
          db,
          repeats,
          imported ? { uri: imported, reference, language: "auto" } : undefined,
        ),
      );
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  const history = async () => {
    try {
      const row = await db.getFirstAsync<{ report_json: string }>(
        "SELECT report_json FROM benchmark_runs ORDER BY created_at DESC LIMIT 1",
      );
      if (row) setReport(JSON.parse(row.report_json));
      else setError("No benchmark has been saved yet.");
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  const share = async () => {
    try {
      if (!report) return;
      if (!(await Sharing.isAvailableAsync()))
        throw Error("File sharing is unavailable.");
      const file = new File(
        Paths.cache,
        `spidernote-benchmark-${report.id}.json`,
      );
      file.write(JSON.stringify(report, null, 2));
      await Sharing.shareAsync(file.uri, { mimeType: "application/json" });
    } catch (error) {
      setError(errorMessage(error));
    }
  };
  return (
    <Screen>
      <Header title="Automatic benchmark" />
      <Text style={ui.title}>Same samples. Fair comparison.</Text>
      <Text style={ui.body}>
        No microphone recording needed. Runs the downloaded speech models
        against a short public English clip and silence, then tests Qwen on
        English, Filipino and Taglish text. Every note format is rendered from
        the extracted passages. Silence is tested with and without the
        digital-silence gate.
      </Text>
      <Notice>
        This smoke suite is not a full quality certification. It does not
        include natural Taglish speech or real meetings. Run on a physical 4 GB
        target phone, in airplane mode after downloading models, and compare
        results at similar device temperatures.
      </Notice>
      <View style={ui.row}>
        <Chip
          label="1 run · quick"
          selected={repeats === 1}
          onPress={() => setRepeats(1)}
        />
        <Chip
          label="3 runs · repeatability"
          selected={repeats === 3}
          onPress={() => setRepeats(3)}
        />
      </View>
      <Button
        label="Run built-in benchmark"
        onPress={run}
        disabled={status.busy}
      />
      <AiProgress />
      {error && <Notice error>{error}</Notice>}
      <View style={ui.card}>
        <Text style={ui.heading}>Optional existing audio</Text>
        <Text style={ui.body}>
          Import an existing recording or public test file. It stays on this
          device. Nothing is submitted to the report form.
        </Text>
        <Button
          label={imported ? "Replace imported clip" : "Choose audio file"}
          secondary
          disabled={status.busy}
          onPress={async () => {
            try {
              const result = await DocumentPicker.getDocumentAsync({
                type: "audio/*",
                copyToCacheDirectory: true,
              });
              if (!result.canceled) setImported(result.assets[0].uri);
            } catch (error) {
              setError(errorMessage(error));
            }
          }}
        />
        {imported && (
          <>
            <Text style={ui.caption}>
              One existing clip selected. The built-in tests will still run.
            </Text>
            <TextInput
              accessibilityLabel="Reference transcript for imported audio"
              value={reference}
              onChangeText={setReference}
              editable={!status.busy}
              multiline
              maxLength={30000}
              style={[ui.input, { minHeight: 120 }]}
              placeholder="Optional correct transcript, for word-error scoring"
              placeholderTextColor={C.muted}
            />
            <Button
              label="Remove imported clip"
              secondary
              disabled={status.busy}
              onPress={() => {
                setImported(undefined);
                setReference("");
              }}
            />
          </>
        )}
      </View>
      <Button
        label="Load last report"
        secondary
        onPress={history}
        disabled={status.busy}
      />
      {report && (
        <>
          <Text selectable style={ui.heading}>
            Run ID: {report.id}
          </Text>
          <Text style={ui.caption}>
            {report.createdAt} · {report.appVersion}
          </Text>
          {report.results.map((result, index) => (
            <View key={index} style={ui.card}>
              <Text style={ui.heading}>
                {result.sampleId} · {result.status}
              </Text>
              <Text style={ui.caption}>
                {result.modelId} · run {result.iteration}
              </Text>
              <Text selectable style={ui.body}>
                {JSON.stringify(
                  {
                    metrics: result.metrics,
                    scores: result.scores,
                    error: result.error,
                    diagnostics: result.diagnostics,
                  },
                  null,
                  2,
                )}
              </Text>
            </View>
          ))}
          <Notice>{report.limitations.join("\n\n")}</Notice>
          <Button label="Export benchmark JSON" icon="export" onPress={share} />
          <Text style={ui.caption}>
            The report contains device/model metadata and scores, not raw audio
            or transcript text. Review it before sharing. Include the Run ID in
            your report form description if useful.
          </Text>
        </>
      )}
      <Button label="Report an AI issue" secondary onPress={reportAiIssue} />
    </Screen>
  );
}
