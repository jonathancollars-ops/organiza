import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import { Subject, ThemeType, Semester } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (updatedSubject: Subject) => void;
  onDelete: (subjectId: string) => void;
  subject: Subject | null;
  theme: ThemeType;
  semesters?: Semester[];
}

const PRESET_COLORS = [
  '#0A84FF', // Blue
  '#00FFAA', // Mint
  '#FF9F0A', // Orange
  '#FF375F', // Pink
  '#BF5AF2', // Purple
  '#FFD60A', // Yellow
  '#30D158', // Green
  '#64D2FF', // Cyan
  '#AC8E68', // Brown
];

export const EditSubjectModal: React.FC<Props> = ({
  visible,
  onClose,
  onSave,
  onDelete,
  subject,
  theme,
  semesters = []
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [name, setName] = useState('');
  const [color, setColor] = useState('#0A84FF');
  const [passGrade, setPassGrade] = useState(7.0);
  const [maxAbsences, setMaxAbsences] = useState(15);
  const [workloadHours, setWorkloadHours] = useState(60);
  const [semesterId, setSemesterId] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (visible && subject) {
      setName(subject.name || '');
      setColor(subject.color || '#0A84FF');
      setPassGrade(subject.passGrade ?? 7.0);
      setMaxAbsences(subject.maxAbsences ?? 15);
      setWorkloadHours(subject.workloadHours ?? 60);
      setSemesterId(subject.semesterId);
      setNotes(subject.notes || '');
    }
  }, [visible, subject]);

  if (!visible && !subject) return null;

  const safeSubject: Subject = subject || {
    id: '',
    name: name || '',
    color: color || '#0A84FF',
    passGrade: passGrade ?? 7.0,
    maxAbsences: maxAbsences ?? 15,
    workloadHours: workloadHours ?? 60,
    gradeGroups: []
  };

  const handleSave = () => {
    if (!name.trim()) {
      Alert.alert('Aviso', 'O nome da matéria não pode ficar em branco.');
      return;
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const updated: Subject = {
        ...safeSubject,
        name: name.trim(),
        color,
        passGrade,
        maxAbsences,
        workloadHours,
        semesterId,
        notes: notes.trim() || undefined
      };

      onSave(updated);
    } catch (e) {
      console.warn('Erro ao salvar matéria editada:', e);
    } finally {
      onClose();
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      'Excluir Matéria',
      `Tem certeza que deseja excluir "${safeSubject.name || 'esta matéria'}"? Isso removerá a matéria permanentemente.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir Matéria',
          style: 'destructive',
          onPress: () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              if (safeSubject.id) {
                onDelete(safeSubject.id);
              }
            } catch (e) {
              console.warn('Erro ao excluir matéria:', e);
            } finally {
              onClose();
            }
          }
        }
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerActionBtn} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Editar Matéria</Text>
          <TouchableOpacity onPress={handleSave} style={styles.headerActionBtn} activeOpacity={0.7}>
            <Text style={styles.saveText}>Salvar</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Nome da Matéria</Text>
          <TextInput
            style={styles.input}
            placeholder="Ex: Cálculo I"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />

          <Text style={styles.label}>Cor da Matéria</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
            {PRESET_COLORS.map(c => {
              const isSelected = color === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorCircle,
                    {
                      backgroundColor: c,
                      borderColor: isSelected ? colors.text : 'transparent',
                      borderWidth: isSelected ? 3 : 0,
                      transform: [{ scale: isSelected ? 1.1 : 1 }]
                    }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setColor(c);
                  }}
                  activeOpacity={0.8}
                >
                  {isSelected && (
                    <Text style={{ color: getContrastTextColor(c), fontWeight: '800', fontSize: 13 }}>✓</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {semesters.length > 0 && (
            <View style={{ marginBottom: 18 }}>
              <Text style={styles.label}>Semestre / Período</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                  style={[
                    styles.badge,
                    {
                      backgroundColor: !semesterId ? colors.primary : colors.surfaceSubtle,
                      borderColor: !semesterId ? colors.primary : colors.border,
                      borderWidth: 1
                    }
                  ]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSemesterId(undefined);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: !semesterId ? getContrastTextColor(colors.primary) : colors.text, fontWeight: '700' }}>
                    Nenhum
                  </Text>
                </TouchableOpacity>
                {semesters.map(sem => {
                  const isSelected = semesterId === sem.id;
                  return (
                    <TouchableOpacity
                      key={sem.id}
                      style={[
                        styles.badge,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceSubtle,
                          borderColor: isSelected ? colors.primary : colors.border,
                          borderWidth: 1
                        }
                      ]}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setSemesterId(sem.id);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={{ color: isSelected ? getContrastTextColor(colors.primary) : colors.text, fontWeight: '700' }}>
                        {sem.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.label}>Limite de Faltas</Text>
              <View style={[styles.input, { paddingVertical: 0, justifyContent: 'center' }]}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>
                  {maxAbsences} faltas
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Média para Passar</Text>
              <View style={[styles.input, { paddingVertical: 0, justifyContent: 'center' }]}>
                <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 17, textAlign: 'center' }}>
                  {passGrade.toFixed(1)}
                </Text>
              </View>
            </View>
          </View>

          <View style={[styles.sliderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { marginBottom: 0, marginTop: 0 }]}>Ajustar Média Mínima ({passGrade.toFixed(1)})</Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={5}
              maximumValue={10}
              step={0.1}
              value={passGrade}
              onValueChange={setPassGrade}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>

          <View style={[styles.sliderCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { marginBottom: 0, marginTop: 0 }]}>Ajustar Limite de Faltas ({maxAbsences})</Text>
            <Slider
              style={{ width: '100%', height: 40 }}
              minimumValue={1}
              maximumValue={40}
              step={1}
              value={maxAbsences}
              onValueChange={setMaxAbsences}
              minimumTrackTintColor={colors.primary}
              maximumTrackTintColor={colors.border}
              thumbTintColor={colors.primary}
            />
          </View>

          <Text style={styles.label}>Anotações / Informações do Professor</Text>
          <TextInput
            style={[styles.input, { height: 85, textAlignVertical: 'top' }]}
            placeholder="Ex: Sala 302, Prof. Carlos, e-mail: carlos@univ.br"
            placeholderTextColor={colors.textSecondary}
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity
            style={[styles.deleteBtn, { backgroundColor: colors.dangerLight, borderColor: colors.danger }]}
            onPress={confirmDelete}
            activeOpacity={0.7}
          >
            <Text style={{ color: theme === 'light' ? colors.dangerDark : colors.danger, fontWeight: '800', fontSize: 15 }}>🗑️ Excluir Matéria</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  headerActionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  cancelText: {
    fontSize: 15,
    color: colors.primary,
    fontWeight: '700',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.primary,
  },
  content: {
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    marginTop: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 14,
    backgroundColor: colors.surface,
  },
  sliderCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
  },
  colorCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center'
  },
  badge: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 15,
    alignItems: 'center',
    marginTop: 15,
  }
});

