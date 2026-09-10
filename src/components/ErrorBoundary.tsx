import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Lumen Crash Shield] Unhandled React render error:', error, errorInfo);
    try {
      AsyncStorage.setItem(
        '@lumen_last_crash_log',
        JSON.stringify({
          timestamp: new Date().toISOString(),
          message: error?.message || 'Unknown error',
          stack: error?.stack || '',
          componentStack: errorInfo?.componentStack || '',
        })
      ).catch(() => {});
    } catch {
      // Ignora falhas de persistência
    }
    this.setState({ errorInfo });
  }

  private handleRestart = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleClearTransientData = async () => {
    try {
      await AsyncStorage.multiRemove([
        '@lumen_active_timer',
        '@lumen_update_state',
      ]);
    } catch {
      // Ignora falhas de limpeza
    }
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
              <Text style={styles.icon}>🎓</Text>
              <Text style={styles.title}>Lumen Acadêmico</Text>
              <Text style={styles.subtitle}>
                O aplicativo encontrou uma instabilidade temporária ao iniciar. Seus dados cadastrados estão preservados com segurança.
              </Text>

              {this.state.error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorTitle}>Detalhes do Erro:</Text>
                  <Text style={styles.errorText} numberOfLines={6}>
                    {this.state.error.toString()}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={this.handleRestart}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryBtnText}>🔄 Reiniciar Aplicativo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={this.handleClearTransientData}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryBtnText}>🧹 Limpar Cache Temporário</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E131F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#181F32',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A3650',
    padding: 24,
    alignItems: 'center',
  },
  icon: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0F4FC',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 12,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F87171',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  errorText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#CBD5E1',
    lineHeight: 15,
  },
  primaryBtn: {
    width: '100%',
    backgroundColor: '#0EA5E9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  secondaryBtn: {
    width: '100%',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
  },
});
