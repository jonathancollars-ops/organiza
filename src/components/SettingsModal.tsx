import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  SafeAreaView,
  TextInput,
  Switch,
  Alert,
  Platform,
  StatusBar as RNStatusBar
} from 'react-native';
import { ThemeType, AppSettings, Semester, BackupData } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { StorageService } from '../services/storage';
import { generateId } from '../utils/id';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeType;
  onThemeChange: (theme: ThemeType) => void;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  semesters: Semester[];
  onUpdateSemesters: (semesters: Semester[]) => void;
  onOpenGuide: () => void;
  onRestoreSuccess: () => void;
}

export const SettingsModal: React.FC<Props> = ({
  visible,
  onClose,
  theme,
  onThemeChange,
  settings,
  onUpdateSettings,
  semesters,
  onUpdateSemesters,
  onOpenGuide,
  onRestoreSuccess
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'semestres' | 'backup'>('geral');

  // Semester management
  const [newSemesterName, setNewSemesterName] = useState('');

  // Backup state
  const [backupJsonText, setBackupJsonText] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Settings local state
  const [focusMin, setFocusMin] = useState(settings.pomodoroFocusMin.toString());
  const [breakMin, setBreakMin] = useState(settings.pomodoroBreakMin.toString());
  const [passGrade, setPassGrade] = useState(settings.defaultPassGrade.toString());
  const [soundEnabled, setSoundEnabled] = useState(settings.soundEnabled);
  const [hapticsEnabled, setHapticsEnabled] = useState(settings.hapticsEnabled);
  const [examWeekMode, setExamWeekMode] = useState(settings.examWeekMode);

  React.useEffect(() => {
    if (visible) {
      setFocusMin(settings.pomodoroFocusMin.toString());
      setBreakMin(settings.pomodoroBreakMin.toString());
      setPassGrade(settings.defaultPassGrade.toString());
      setSoundEnabled(settings.soundEnabled);
      setHapticsEnabled(settings.hapticsEnabled);
      setExamWeekMode(settings.examWeekMode);
      setBackupJsonText('');
    }
  }, [visible, settings]);

  const handleSaveSettings = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const updated: AppSettings = {
      ...settings,
      pomodoroFocusMin: parseInt(focusMin, 10) || 25,
      pomodoroBreakMin: parseInt(breakMin, 10) || 5,
      defaultPassGrade: parseFloat(passGrade.replace(',', '.')) || 7.0,
      soundEnabled,
      hapticsEnabled,
      examWeekMode,
    };
    onUpdateSettings(updated);
    await StorageService.saveSettings(updated);
    Alert.alert('Sucesso', 'Configurações salvas com sucesso!');
  };

  const handleAddSemester = () => {
    if (!newSemesterName.trim()) return;
    Haptics.selectionAsync();
    const newSem: Semester = {
      id: generateId('sem'),
      name: newSemesterName.trim(),
      isCurrent: semesters.length === 0,
      isArchived: false,
    };
    const updated = [...semesters, newSem];
    onUpdateSemesters(updated);
    StorageService.saveSemesters(updated);
    setNewSemesterName('');
  };

  const toggleCurrentSemester = (semId: string) => {
    Haptics.selectionAsync();
    const updated = semesters.map(s => ({
      ...s,
      isCurrent: s.id === semId
    }));
    onUpdateSemesters(updated);
    StorageService.saveSemesters(updated);
  };

  const toggleArchiveSemester = (semId: string) => {
    Haptics.selectionAsync();
    const updated = semesters.map(s => s.id === semId ? { ...s, isArchived: !s.isArchived } : s);
    onUpdateSemesters(updated);
    StorageService.saveSemesters(updated);
  };

  const handleDeleteSemester = (semId: string) => {
    Alert.alert('Excluir Semestre', 'Deseja remover este semestre da lista?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          const updated = semesters.filter(s => s.id !== semId);
          onUpdateSemesters(updated);
          StorageService.saveSemesters(updated);
        }
      }
    ]);
  };

  const handleExportBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExporting(true);
    try {
      const backupData = await StorageService.exportBackup();
      const json = JSON.stringify(backupData, null, 2);
      setBackupJsonText(json);
      Alert.alert('Backup Gerado!', 'Os dados foram formatados em JSON abaixo. Você pode copiá-los para guardar em segurança.');
    } catch (e: any) {
      Alert.alert('Erro ao exportar', e?.message || 'Falha na exportação.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportBackup = async () => {
    if (!backupJsonText.trim()) {
      Alert.alert('Aviso', 'Cole o JSON de backup na caixa de texto primeiro.');
      return;
    }

    try {
      const parsed: BackupData = JSON.parse(backupJsonText);
      await StorageService.importBackup(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Backup Restaurado!', 'Todos os seus eventos, matérias e dados foram restaurados com sucesso.', [
        {
          text: 'OK',
          onPress: () => {
            onRestoreSuccess();
            onClose();
          }
        }
      ]);
    } catch (e: any) {
      Alert.alert('Erro ao restaurar', 'JSON inválido ou corrompido: ' + (e?.message || ''));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 15, color: colors.danger, fontWeight: '600' }}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Configurações</Text>
          <TouchableOpacity onPress={handleSaveSettings} style={styles.saveBtn} activeOpacity={0.7}>
            <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 15 }}>Salvar</Text>
          </TouchableOpacity>
        </View>

        {/* Sub tabs */}
        <View style={styles.subTabs}>
          {[
            { id: 'geral', label: '⚙️ Geral' },
            { id: 'semestres', label: '🎓 Semestres' },
            { id: 'backup', label: '💾 Backup' }
          ].map(t => {
            const isSelected = activeSubTab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.subTab,
                  isSelected && { borderBottomColor: colors.primary, borderBottomWidth: 3 }
                ]}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveSubTab(t.id as any);
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.subTabText,
                    {
                      color: isSelected ? colors.primary : colors.textSecondary,
                      fontWeight: isSelected ? '800' : '600'
                    }
                  ]}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {activeSubTab === 'geral' ? (
            <>
              {/* Theme Picker */}
              <Text style={styles.sectionTitle}>Aparência & Tema</Text>
              <View style={styles.row}>
                {[
                  { id: 'dark', label: '🌙 Escuro' },
                  { id: 'light', label: '☀️ Claro' },
                  { id: 'amoled', label: '🖤 AMOLED' }
                ].map(th => {
                  const isSelected = theme === th.id;
                  return (
                    <TouchableOpacity
                      key={th.id}
                      style={[
                        styles.themeOption,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surface,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: 1
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        onThemeChange(th.id as ThemeType);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{
                        color: isSelected ? getContrastTextColor(colors.primary) : colors.text,
                        fontWeight: '700',
                        fontSize: 13
                      }}>
                        {th.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Modo Semana de Provas */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 16 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>🎯 Modo Semana de Provas</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2, lineHeight: 16 }}>
                      Filtra a agenda para destacar apenas Provas e Trabalhos urgentes.
                    </Text>
                  </View>
                  <Switch
                    value={examWeekMode}
                    onValueChange={(val) => {
                      Haptics.selectionAsync();
                      setExamWeekMode(val);
                    }}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={examWeekMode ? '#fff' : '#f4f3f4'}
                  />
                </View>
              </View>

              {/* Pomodoro settings */}
              <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Preferências do Pomodoro</Text>
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.settingRow}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Tempo de Foco (minutos)</Text>
                  <TextInput
                    style={[styles.smallInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    keyboardType="numeric"
                    value={focusMin}
                    onChangeText={setFocusMin}
                  />
                </View>

                <View style={[styles.settingRow, { borderTopWidth: 1, borderTopColor: colors.borderSubtle }]}>
                  <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Pausa Curta (minutos)</Text>
                  <TextInput
                    style={[styles.smallInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                    keyboardType="numeric"
                    value={breakMin}
                    onChangeText={setBreakMin}
                  />
                </View>
              </View>

              {/* General App Info & Guide */}
              <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Ajuda e Informações</Text>
              <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                onPress={() => {
                  Haptics.selectionAsync();
                  onClose();
                  onOpenGuide();
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 20, marginRight: 10 }}>📖</Text>
                  <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>Abrir Guia do Usuário</Text>
                </View>
                <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '700' }}>›</Text>
              </TouchableOpacity>
            </>
          ) : activeSubTab === 'semestres' ? (
            <>
              <Text style={styles.sectionTitle}>Períodos Letivos / Semestres</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
                Organize suas matérias por semestre letivo para arquivar períodos passados facilmente.
              </Text>

              {/* Add semester input */}
              <View style={{ flexDirection: 'row', marginBottom: 18 }}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0, marginRight: 8, color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                  placeholder="Ex: 2026.1, 2026.2"
                  placeholderTextColor={colors.textSecondary}
                  value={newSemesterName}
                  onChangeText={setNewSemesterName}
                />
                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: colors.primary }]}
                  onPress={handleAddSemester}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800' }}>+ Adicionar</Text>
                </TouchableOpacity>
              </View>

              {/* Semester list */}
              {semesters.length === 0 ? (
                <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'center', padding: 25 }]}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🎓</Text>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center', fontWeight: '500' }}>
                    Nenhum semestre cadastrado. Adicione um para organizar suas matérias.
                  </Text>
                </View>
              ) : (
                semesters.map(sem => (
                  <View
                    key={sem.id}
                    style={[
                      styles.card,
                      {
                        backgroundColor: colors.surface,
                        borderColor: sem.isCurrent ? colors.primary : colors.border,
                        borderWidth: sem.isCurrent ? 2 : 1,
                        marginBottom: 10
                      }
                    ]}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16 }}>
                          {sem.name} {sem.isCurrent && <Text style={{ color: colors.primary, fontSize: 13 }}>(Atual)</Text>}
                        </Text>
                        {sem.isArchived && (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>Arquivado</Text>
                        )}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        {!sem.isCurrent && (
                          <TouchableOpacity
                            style={[styles.smallBtn, { borderColor: colors.primary, borderWidth: 1 }]}
                            onPress={() => toggleCurrentSemester(sem.id)}
                            activeOpacity={0.7}
                          >
                            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Definir Atual</Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[styles.smallBtn, { borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surfaceSubtle }]}
                          onPress={() => toggleArchiveSemester(sem.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                            {sem.isArchived ? 'Desarquivar' : 'Arquivar'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.smallBtn, { borderColor: colors.danger, borderWidth: 1, backgroundColor: colors.dangerLight }]}
                          onPress={() => handleDeleteSemester(sem.id)}
                          activeOpacity={0.7}
                        >
                          <Text style={{ color: colors.danger, fontSize: 12, fontWeight: '800' }}>✕</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Backup e Restauração de Dados</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 14, lineHeight: 18 }}>
                Faça o backup de todos os seus eventos, matérias, tarefas e faltas em formato JSON seguro.
              </Text>

              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
                <TouchableOpacity
                  style={[styles.backupBtn, { backgroundColor: colors.primary, flex: 1 }]}
                  onPress={handleExportBackup}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 13 }}>
                    📤 Gerar Backup JSON
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.backupBtn, { backgroundColor: '#3b82f6', flex: 1 }]}
                  onPress={handleImportBackup}
                  activeOpacity={0.8}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>
                    📥 Restaurar Backup
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[styles.label, { color: colors.text }]}>Conteúdo JSON do Backup:</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    height: 180,
                    textAlignVertical: 'top',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
                    fontSize: 12
                  }
                ]}
                placeholder="Clique em 'Gerar Backup' ou cole o JSON para restaurar..."
                placeholderTextColor={colors.textSecondary}
                multiline
                value={backupJsonText}
                onChangeText={setBackupJsonText}
              />
            </>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 6 : 0
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  closeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  saveBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  subTabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  subTab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
  },
  subTabText: {
    fontSize: 13,
  },
  content: {
    padding: 18,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  themeOption: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  smallInput: {
    width: 65,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 15,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  addBtn: {
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backupBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  }
});

