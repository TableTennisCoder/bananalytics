// Polyfill MUST be first import — before uuid/Rochade
import "react-native-get-random-values";

import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { RochadeClient } from "@rochade/react-native";

const API_KEY = "rk_28e0bae1-43e6-498f-9404-9be05eb8c891";
const ENDPOINT = "http://192.168.178.70:8080";

// Create client once, passing AsyncStorage explicitly
let client: RochadeClient | null = null;

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  const log = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [`[${timestamp}] ${message}`, ...prev]);
  };

  const handleInit = async () => {
    try {
      client = new RochadeClient(
        {
          apiKey: API_KEY,
          endpoint: ENDPOINT,
          debug: true,
          flushInterval: 5000,
          flushAt: 1,
        },
        AsyncStorage,
      );
      await client.initialize();
      setInitialized(true);
      log("SDK initialized");
    } catch (err) {
      log(`Init failed: ${err}`);
    }
  };

  const handleTrack = () => {
    client?.track("button_clicked", {
      button: "test_button",
      screen: "main",
      timestamp: new Date().toISOString(),
    });
    log("Tracked: button_clicked");
  };

  const handleScreen = () => {
    client?.screen("TestScreen", { tab: "home" });
    log("Tracked: screen TestScreen");
  };

  const handleIdentify = () => {
    client?.identify("test-user-001", {
      name: "Test User",
      plan: "pro",
      signupDate: "2025-01-01",
    });
    log("Identified: test-user-001");
  };

  const handleReset = () => {
    client?.reset();
    log("Identity reset");
  };

  const handleFlush = async () => {
    log("Flushing...");
    await client?.flush();
    log("Flush complete");
  };

  const handleOptOut = () => {
    client?.optOut();
    log("Opted out");
  };

  const handleOptIn = () => {
    client?.optIn();
    log("Opted in");
  };

  return (
    <View style={styles.container}>
      <StatusBar style="auto" />
      <Text style={styles.title}>Rochade SDK Test</Text>
      <Text style={styles.subtitle}>
        {initialized ? "SDK Initialized" : "Not initialized"} ({Platform.OS})
      </Text>

      <View style={styles.buttonGrid}>
        <Pressable
          style={[styles.button, styles.initButton]}
          onPress={handleInit}
        >
          <Text style={styles.buttonText}>Init SDK</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleTrack}>
          <Text style={styles.buttonText}>Track Event</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleScreen}>
          <Text style={styles.buttonText}>Track Screen</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleIdentify}>
          <Text style={styles.buttonText}>Identify User</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleFlush}>
          <Text style={styles.buttonText}>Flush</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={handleReset}>
          <Text style={styles.buttonText}>Reset</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.dangerButton]}
          onPress={handleOptOut}
        >
          <Text style={styles.buttonText}>Opt Out</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.successButton]}
          onPress={handleOptIn}
        >
          <Text style={styles.buttonText}>Opt In</Text>
        </Pressable>
      </View>

      <Text style={styles.logTitle}>Event Log</Text>
      <ScrollView style={styles.logContainer}>
        {logs.map((entry, i) => (
          <Text key={i} style={styles.logEntry}>
            {entry}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
  },
  buttonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#2563eb",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    minWidth: 130,
    alignItems: "center",
  },
  initButton: {
    backgroundColor: "#7c3aed",
    minWidth: 270,
  },
  dangerButton: {
    backgroundColor: "#dc2626",
  },
  successButton: {
    backgroundColor: "#16a34a",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  logContainer: {
    flex: 1,
    backgroundColor: "#1e1e1e",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  logEntry: {
    color: "#a5f3a3",
    fontFamily: "monospace",
    fontSize: 12,
    marginBottom: 4,
  },
});
