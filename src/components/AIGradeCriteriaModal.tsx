import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Subject, ThemeType, GradeFormulaExtraction, GradeGroup, GradeItem } from '../types';
import { LocalAIInferenceService } from '../services/LocalAIInferenceService';
import { StorageService } from '../services/storage';
import { generateId } from '../utils';
import { getThemeColors, getContrastTextColor } from '../theme';
import * as Haptics from 'expo-haptics';

export interface AIGradeCriteriaModalProps {
  visible: boolean;
  onClose: () => void;
  subject: Subject | null;
  onApplyCriteria: (updatedSubject: Subject) => void;
  theme: ThemeType;
}

export const AIGradeCriteriaModal: React.FC<AIGradeCriteriaModalProps> = ({
  visible,
  onClose,
  subject,
  onApplyCriteria,
  theme
}) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [criteriaText, setCriteriaText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewFormula, setPreviewFormula] = useState<GradeFormulaExtraction | null>(null);

  if (!subject) return null;

  const handleProcessCriteria = async () => {
    if (!criteriaText.trim()) {
      Alert.alert('Texto Vazio', 'Descreva como são calculadas as notas da sua matéria.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsProcessing(true);

    try {
      const aiConfig = await StorageService.getAIConfig();
      const result = await LocalAIInferenceService.extractGradeFormula(
        criteriaText,
        aiConfig,
        subject.passGrade || 7.0
      );

      setPreviewFormula(result);
      setIsProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setIsProcessing(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro ao Processar', err?.message || 'Falha ao analisar a regra de notas.');
    }
  };

  const handleApplyToSubject = () => {
    if (!previewFormula || !subject) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Convert GradeFormulaExtraction to Subject gradeGroups
    const newGradeGroups: GradeGroup[] = previewFormula.groups.map(grp => {
      const groupId = generateId('group');
      const items: GradeItem[] = grp.items.map(it => ({
        id: generateId('grade_item'),
        name: it.name,
        weight: it.weight,
        maxGrade: it.maxGrade || 10
      }));

      return {
        id: groupId,
        name: grp.name,
        weight: grp.weight,
        items
      };
    });

    const updatedSubject: Subject = {
      ...subject,
      passGrade: previewFormula.passGrade,
      gradeGroups: newGradeGroups
    };

    onApplyCriteria(updatedSubject);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Fórmula Aplicada! 🎓',
      `O sistema de notas de "${subject.name}" foi atualizado com sucesso conforme a regra informada.`,
      [{ text: 'OK', onPress: onClose }]
    );
  };

  const setTemplate = (type: 'weights' | 'exams3' | 'extra' | 'project') => {
    Haptics.selectionAsync();
    if (type === 'weights') {
      setCriteriaText(`São duas provas no semestre: P1 tem peso 4 e P2 tem peso 6. A média mínima para aprovação é ${subject.passGrade || 7.0}.`);
    } else if (type === 'exams3') {
      setCriteriaText(`Temos 3 provas no semestre (P1, P2 e P3) com pesos iguais. A média para passar direto é ${subject.passGrade || 7.0}.`);
    } else if (type === 'extra') {
      setCriteriaText(`A média é calculada por 2 provas (P1 e P2), mais 1 trabalho prático que vale até 2.0 pontos extras direto na média final.`);
    } else {
      setCriteriaText(`A avaliação é composta por Provas com 70% do peso da média e Trabalhos/Seminários com 30% do peso.`);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.title}>✨ Configurar Média com IA</Text>
            <Text style={styles.subtitle}>{subject.name}</Text>
          </View>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionTitle}>Como sua faculdade calcula a nota?</Text>
          <Text style={styles.sectionSubtitle}>
            Escreva ou cole o critério do professor em linguagem natural. A IA calcula os pesos e cria a estrutura de notas para você!
          </Text>

          {/* Text Input */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={styles.textArea}
              multiline
              numberOfLines={4}
              value={criteriaText}
              onChangeText={setCriteriaText}
              placeholder="Ex: São 2 provas (P1 peso 4 e P2 peso 6) e um seminário valendo até 1.5 ponto extra na média final. Média 7.0 para aprovação."
              placeholderTextColor={colors.textSecondary}
              textAlignVertical="top"
            />

            {/* Quick Templates */}
            <View style={styles.templateContainer}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 6 }}>
                Exemplos de regras comuns:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                <TouchableOpacity style={styles.templateChip} onPress={() => setTemplate('weights')}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>⚖️ Provas Pesos 4 e 6</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.templateChip} onPress={() => setTemplate('extra')}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>⭐ Provas + Ponto Extra</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.templateChip} onPress={() => setTemplate('exams3')}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>📝 3 Provas (P1, P2, P3)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.templateChip} onPress={() => setTemplate('project')}>
                  <Text style={{ fontSize: 10, color: colors.primary, fontWeight: '700' }}>📊 Provas (70%) + Projeto (30%)</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Process Button */}
          <TouchableOpacity
            style={[
              styles.processBtn,
              { backgroundColor: colors.primary },
              (!criteriaText.trim() || isProcessing) && { opacity: 0.6 }
            ]}
            onPress={handleProcessCriteria}
            disabled={!criteriaText.trim() || isProcessing}
            activeOpacity={0.8}
          >
            {isProcessing ? (
              <ActivityIndicator color={getContrastTextColor(colors.primary)} size="small" />
            ) : (
              <Text style={[styles.processBtnText, { color: getContrastTextColor(colors.primary) }]}>
                ✨ Gerar Estrutura com IA
              </Text>
            )}
          </TouchableOpacity>

          {/* Preview Structure */}
          {previewFormula && (
            <View style={[styles.previewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.previewTitle}>📋 Estrutura Gerada pela IA</Text>
              <Text style={{ fontSize: 13, color: colors.text, fontWeight: '700', marginBottom: 8 }}>
                {previewFormula.description}
              </Text>

              <View style={[styles.infoBadge, { backgroundColor: colors.surfaceSubtle }]}>
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                  🎯 Nota Mínima para Aprovação: <Text style={{ fontWeight: '800', color: colors.primary }}>{previewFormula.passGrade.toFixed(1)}</Text>
                </Text>
              </View>

              {previewFormula.groups.map((group, idx) => (
                <View key={idx} style={[styles.groupCard, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>
                      📁 {group.name}
                    </Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.primary }}>
                      Peso no cálculo: {group.weight}
                    </Text>
                  </View>

                  {group.items.map((item, iIdx) => (
                    <View key={iIdx} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>• {item.name}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text }}>
                        Peso: {item.weight} (Máx: {item.maxGrade})
                      </Text>
                    </View>
                  ))}
                </View>
              ))}

              {previewFormula.extraPoints && (
                <View style={[styles.extraBadge, { backgroundColor: 'rgba(234, 179, 8, 0.12)' }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: theme === 'light' ? '#b45309' : '#FBBF24' }}>
                    ⭐ Ponto Extra: {previewFormula.extraPoints.name} (até +{previewFormula.extraPoints.maxPoints} pts na média)
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.applyBtn, { backgroundColor: colors.success }]}
                onPress={handleApplyToSubject}
                activeOpacity={0.8}
              >
                <Text style={{ color: getContrastTextColor(colors.success), fontWeight: '800', fontSize: 14 }}>
                  ✅ Aplicar esta Fórmula à Matéria
                </Text>
              </TouchableOpacity>
            </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1
  },
  cancelText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4
  },
  sectionSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
    marginBottom: 12
  },
  card: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14
  },
  textArea: {
    fontSize: 14,
    color: colors.text,
    minHeight: 85,
    padding: 6
  },
  templateContainer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
    marginTop: 8
  },
  templateChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    marginRight: 6,
    marginBottom: 6
  },
  processBtn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  processBtnText: {
    fontSize: 14,
    fontWeight: '800',
  },
  previewCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 14
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6
  },
  infoBadge: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 10
  },
  groupCard: {
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8
  },
  extraBadge: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 10
  },
  applyBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  }
});
