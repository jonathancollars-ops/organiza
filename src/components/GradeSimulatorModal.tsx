import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Subject, ThemeType } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { calculateFinalGrade } from './GradeEngine';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  subjects: Subject[];
  theme: ThemeType;
  initialSubjectId?: string;
}

export const GradeSimulatorModal: React.FC<Props> = ({
  visible,
  onClose,
  subjects,
  theme,
  initialSubjectId
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectId || (subjects.length > 0 ? subjects[0].id : '')
  );
  const [targetPassGrade, setTargetPassGrade] = useState<string>('7.0');

  React.useEffect(() => {
    if (visible) {
      if (initialSubjectId) {
        setSelectedSubjectId(initialSubjectId);
      } else if (subjects.length > 0 && !selectedSubjectId) {
        setSelectedSubjectId(subjects[0].id);
      }
    }
  }, [visible, initialSubjectId, subjects]);

  const currentSubject = subjects.find(s => s.id === selectedSubjectId);

  const parsed = parseFloat(targetPassGrade.replace(',', '.'));
  const passGradeNum = isNaN(parsed) ? (currentSubject?.passGrade ?? 7.0) : parsed;

  const gradeInfo = useMemo(() => {
    if (!currentSubject) return null;
    return calculateFinalGrade(currentSubject.gradeGroups || [], passGradeNum);
  }, [currentSubject, passGradeNum]);

  const handleSelectSubject = (s: Subject) => {
    Haptics.selectionAsync();
    setSelectedSubjectId(s.id);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Simulador de Notas</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Subject Selector */}
          <Text style={styles.label}>Selecione a Matéria:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 18 }}>
            {subjects.map(s => {
              const isSelected = s.id === selectedSubjectId;
              const subColor = s.color || colors.primary;
              return (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.subjectChip,
                    {
                      backgroundColor: isSelected ? subColor : colors.surface,
                      borderColor: isSelected ? subColor : colors.border,
                      borderWidth: 1
                    }
                  ]}
                  onPress={() => handleSelectSubject(s)}
                  activeOpacity={0.7}
                >
                  <Text style={{
                    color: isSelected ? getContrastTextColor(subColor) : colors.text,
                    fontWeight: isSelected ? '800' : '600',
                    fontSize: 13
                  }}>
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Target Grade Input */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 15 }}>Média de Corte Alvo</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                  Média mínima exigida pela sua instituição
                </Text>
              </View>
              <TextInput
                style={[styles.targetInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                value={targetPassGrade}
                onChangeText={setTargetPassGrade}
                keyboardType="numeric"
                selectTextOnFocus
              />
            </View>
          </View>

          {/* Simulation Output Card */}
          {currentSubject && gradeInfo && (
            <>
              {/* Current Status Overview */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 15 }]}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 }}>
                  Status Atual ({currentSubject.name})
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View>
                    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
                      {gradeInfo.score.toFixed(2)}
                    </Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      Pontos acumulados até agora
                    </Text>
                  </View>
                  <View style={[
                    styles.badge,
                    {
                      backgroundColor: gradeInfo.score >= passGradeNum 
                        ? colors.successLight 
                        : gradeInfo.minimumNeeded !== null && gradeInfo.minimumNeeded > 10 
                          ? colors.dangerLight 
                          : colors.warningLight
                    }
                  ]}>
                    <Text style={{
                      fontWeight: '800',
                      fontSize: 13,
                      color: gradeInfo.score >= passGradeNum 
                        ? (theme === 'light' ? colors.successDark : colors.success) 
                        : gradeInfo.minimumNeeded !== null && gradeInfo.minimumNeeded > 10 
                          ? (theme === 'light' ? colors.dangerDark : colors.danger) 
                          : (theme === 'light' ? colors.warningDark : colors.warning)
                    }}>
                      {gradeInfo.score >= passGradeNum ? 'Aprovado Direto' : gradeInfo.minimumNeeded !== null && gradeInfo.minimumNeeded > 10 ? 'Risco de Final' : 'Em Andamento'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Needed Grade Main Box */}
              <View style={[
                styles.resultCard,
                {
                  backgroundColor: gradeInfo.minimumNeeded === null || gradeInfo.score >= passGradeNum
                    ? colors.successLight
                    : gradeInfo.minimumNeeded <= 10
                      ? colors.surface
                      : colors.dangerLight,
                  borderColor: gradeInfo.minimumNeeded === null || gradeInfo.score >= passGradeNum
                    ? colors.success
                    : gradeInfo.minimumNeeded <= 10
                      ? colors.border
                      : colors.danger,
                }
              ]}>
                <Text style={{ fontSize: 32, marginBottom: 8 }}>
                  {gradeInfo.minimumNeeded === null 
                    ? '🎉' 
                    : gradeInfo.minimumNeeded <= 5 
                      ? '😎' 
                      : gradeInfo.minimumNeeded <= 8 
                        ? '💪' 
                        : '🚨'}
                </Text>

                {gradeInfo.minimumNeeded !== null ? (
                  gradeInfo.minimumNeeded <= 10 ? (
                    <>
                      <Text style={{ fontSize: 15, color: colors.text, textAlign: 'center', marginBottom: 4, fontWeight: '600' }}>
                        Para passar direto com média {passGradeNum.toFixed(1)}, você precisa de:
                      </Text>
                      <Text style={{
                        fontSize: 40,
                        fontWeight: '800',
                        color: gradeInfo.minimumNeeded <= 5
                          ? (theme === 'light' ? colors.successDark : colors.success)
                          : gradeInfo.minimumNeeded <= 8
                            ? (theme === 'light' ? colors.warningDark : colors.warning)
                            : (theme === 'light' ? colors.dangerDark : colors.danger),
                        letterSpacing: -1
                      }}>
                        {gradeInfo.minimumNeeded.toFixed(1)}
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6 }}>
                        na média ponderada das {gradeInfo.missingItemsCount || 1} avaliação(ões) restante(s).
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ fontSize: 17, fontWeight: '800', color: theme === 'light' ? colors.dangerDark : colors.danger, textAlign: 'center' }}>
                        Impossível passar direto pela média!
                      </Text>
                      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, lineHeight: 18 }}>
                        Você precisará de pelo menos {Math.max(0, 10 - gradeInfo.score).toFixed(1)} na Prova Final para ser aprovado.
                      </Text>
                    </>
                  )
                ) : (
                  <>
                    <Text style={{ fontSize: 17, fontWeight: '800', color: theme === 'light' ? colors.successDark : colors.success, textAlign: 'center' }}>
                      Todas as avaliações já foram concluídas!
                    </Text>
                    <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
                      Média final consolidada: {gradeInfo.score.toFixed(2)}
                    </Text>
                  </>
                )}
              </View>

              {/* Tips Card */}
              <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, marginTop: 15 }]}>
                <Text style={{ color: colors.text, fontWeight: '800', fontSize: 16, marginBottom: 8 }}>💡 Dica Estratégica</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 20 }}>
                  • Distribua seu tempo de estudo na aba <Text style={{ color: colors.primary, fontWeight: '700' }}>Estudos</Text> focando mais tempo nas matérias com maior peso nas provas finais.{'\n'}
                  • Utilize o Pomodoro para manter o foco e evitar sobrecarga na véspera da prova.
                </Text>
              </View>
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
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  content: {
    padding: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  subjectChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
  },
  targetInput: {
    width: 70,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  },
  badge: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    marginRight: 8,
  },
  card: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  resultCard: {
    padding: 22,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    marginTop: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  smallInput: {
    width: 70,
    height: 40,
    borderWidth: 1,
    borderRadius: 10,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
  }
});

