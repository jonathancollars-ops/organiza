import React, { useState, useMemo } from 'react';
import { Subject, GradeGroup, GradeItem, ThemeType } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import { generateId } from '../utils/id';
import * as Haptics from 'expo-haptics';

const RN: any = typeof require !== 'undefined' ? require('react-native') : {};
const {
  View = 'View',
  Text = 'Text',
  TouchableOpacity = 'TouchableOpacity',
  StyleSheet = { create: (s: any) => s },
  TextInput = 'TextInput',
  Alert = { alert: () => {} },
  Modal = 'Modal',
  Switch = 'Switch',
  KeyboardAvoidingView = 'KeyboardAvoidingView',
  ScrollView = 'ScrollView',
  Platform = { OS: 'ios' }
}: any = RN;

const modalName = './AIGradeCriteriaModal';
let AIGradeCriteriaModalComponent: any = null;
const AIGradeCriteriaModal: any = (props: any) => {
  try {
    if (!AIGradeCriteriaModalComponent) {
      AIGradeCriteriaModalComponent = require(modalName).AIGradeCriteriaModal;
    }
    return React.createElement(AIGradeCriteriaModalComponent, props);
  } catch {
    return null;
  }
};

interface Props {
  subject: Subject;
  onUpdateSubject: (updatedSubject: Subject) => void;
  theme: ThemeType;
}

// ── Calculation helpers ──

export interface CalcResult {
  score: number;
  hasMissingItems: boolean;
  missingItemsCount: number;
  totalItemsCount: number;
  /** The minimum average the student needs on ALL remaining items to pass */
  minimumNeeded: number | null;
  /** Se o aluno está na final */
  inFinal: boolean;
  /** Se usou a nota da final para passar */
  usedFinal: boolean;
}

export function calculateFinalGrade(gradeGroups: GradeGroup[] | null | undefined, passGrade: number): CalcResult {
  if (!gradeGroups || !Array.isArray(gradeGroups) || gradeGroups.length === 0)
    return { score: 0, hasMissingItems: false, missingItemsCount: 0, totalItemsCount: 0, minimumNeeded: null, inFinal: false, usedFinal: false };

  const safeGroups = gradeGroups.filter((g): g is GradeGroup => Boolean(g && typeof g === 'object'));

  let totalWeight = 0;
  let totalScore = 0;
  let hasMissingItems = false;
  let missingItemsCount = 0;
  let totalItemsCount = 0;
  
  let finalExamItem: GradeItem | undefined = undefined;
  for (const group of safeGroups) {
    const items = Array.isArray(group.items) ? group.items.filter(Boolean) : [];
    const found = items.find(i => i && i.isFinalExam);
    if (found) {
      finalExamItem = found;
      break;
    }
  }

  safeGroups.forEach(group => {
    const items = Array.isArray(group.items) ? group.items.filter((i): i is GradeItem => Boolean(i && typeof i === 'object')) : [];
    if (items.length === 0) return;

    let groupTotalWeight = 0;
    let groupCompletedWeight = 0;
    let groupTotalScore = 0;

    items.forEach(item => {
      if (item.isFinalExam) {
        finalExamItem = item;
        return; // Don't include in normal average
      }

      totalItemsCount++;
      const itemWeight = Number.isFinite(item.weight) ? Number(item.weight) : 1;
      const itemMax = (Number.isFinite(item.maxGrade) && Number(item.maxGrade) > 0) ? Number(item.maxGrade) : 10;
      groupTotalWeight += itemWeight;
      if (item.grade !== undefined && Number.isFinite(item.grade)) {
        groupCompletedWeight += itemWeight;
        groupTotalScore += (Number(item.grade) / itemMax) * 10 * itemWeight;
      } else {
        hasMissingItems = true;
        missingItemsCount++;
      }
    });

    const groupAvg = groupCompletedWeight > 0 ? groupTotalScore / groupCompletedWeight : 0;
    const gWeight = Number.isFinite(group.weight) ? Number(group.weight) : 1;
    
    if (groupCompletedWeight > 0 && gWeight > 0) {
      totalWeight += gWeight;
      totalScore += groupAvg * gWeight;
    }
  });

  const normalAvg = totalWeight > 0 ? totalScore / totalWeight : 0;

  // Calculate minimum needed on remaining normal items
  let minimumNeeded: number | null = null;
  if (hasMissingItems) {
    let allGroupsTotalWeight = 0;
    let currentTotalPoints = 0;

    safeGroups.forEach(group => {
      const items = Array.isArray(group.items) ? group.items.filter((i): i is GradeItem => Boolean(i && typeof i === 'object')) : [];
      const normalItems = items.filter(i => !i.isFinalExam);
      const groupTotalWeight = normalItems.reduce((s, i) => s + (Number.isFinite(i.weight) ? Number(i.weight) : 1), 0);
      const gWeight = Number.isFinite(group.weight) ? Number(group.weight) : 1;
      if (groupTotalWeight > 0 && gWeight > 0) {
        allGroupsTotalWeight += gWeight;
        const groupScore = normalItems
          .filter(i => i.grade !== undefined && Number.isFinite(i.grade))
          .reduce((sum, i) => sum + (Number(i.grade!) / ((Number.isFinite(i.maxGrade) && Number(i.maxGrade) > 0) ? Number(i.maxGrade) : 10)) * 10 * (Number.isFinite(i.weight) ? Number(i.weight) : 1), 0);
        currentTotalPoints += (groupScore / groupTotalWeight) * gWeight;
      }
    });

    const neededTotal = passGrade * allGroupsTotalWeight;
    const deficit = neededTotal - currentTotalPoints;

    let effectiveMissingWeight = 0;
    safeGroups.forEach(group => {
      const items = Array.isArray(group.items) ? group.items.filter((i): i is GradeItem => Boolean(i && typeof i === 'object')) : [];
      const normalItems = items.filter(i => !i.isFinalExam);
      const groupTotalWeight = normalItems.reduce((s, i) => s + (Number.isFinite(i.weight) ? Number(i.weight) : 1), 0);
      const gWeight = Number.isFinite(group.weight) ? Number(group.weight) : 1;
      normalItems.forEach(item => {
        if (item.grade === undefined && groupTotalWeight > 0 && gWeight > 0) {
          effectiveMissingWeight += ((Number.isFinite(item.weight) ? Number(item.weight) : 1) / groupTotalWeight) * gWeight;
        }
      });
    });

    if (effectiveMissingWeight > 0) {
      minimumNeeded = Math.max(0, deficit / effectiveMissingWeight);
    }
  }

  let finalScore = normalAvg;
  let inFinal = false;
  let usedFinal = false;

  // Final Exam logic
  if (totalItemsCount > 0 && !hasMissingItems && normalAvg < passGrade) {
    inFinal = true;
    if (finalExamItem && finalExamItem.grade !== undefined && Number.isFinite(finalExamItem.grade)) {
      finalScore = (normalAvg + (Number(finalExamItem.grade) / ((Number.isFinite(finalExamItem.maxGrade) && Number(finalExamItem.maxGrade) > 0) ? Number(finalExamItem.maxGrade) : 10) * 10)) / 2;
      usedFinal = true;
    } else if (finalExamItem && finalExamItem.grade === undefined) {
      minimumNeeded = Math.max(0, 10 - normalAvg);
    }
  }

  return { score: finalScore, hasMissingItems, missingItemsCount, totalItemsCount, minimumNeeded, inFinal, usedFinal };
}

export const GradeEngine: React.FC<Props> = ({ subject, onUpdateSubject, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  // Modal State for adding Grade Item
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('1');
  const [newItemMaxGrade, setNewItemMaxGrade] = useState('10');
  const [newItemGrade, setNewItemGrade] = useState('');
  const [newItemIsFinalExam, setNewItemIsFinalExam] = useState(false);
  const [showAdvancedItem, setShowAdvancedItem] = useState(false);

  // Edit grade modal
  const [editGradeVisible, setEditGradeVisible] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editGradeValue, setEditGradeValue] = useState('');
  const [editItemWeight, setEditItemWeight] = useState('1');
  const [editIsFinalExam, setEditIsFinalExam] = useState(false);

  // Final Exam Simulator modal
  const [finalExamModalVisible, setFinalExamModalVisible] = useState(false);
  const [finalExamGrade, setFinalExamGrade] = useState('');
  const [finalExamResult, setFinalExamResult] = useState<{ avg: number; passed: boolean } | null>(null);

  // AI Grade Formula Modal
  const [aiCriteriaModalVisible, setAiCriteriaModalVisible] = useState(false);

  const gradeGroups = subject.gradeGroups || [];
  const passGrade = subject.passGrade || 7.0;

  const gradeInfo = useMemo(() => calculateFinalGrade(gradeGroups, passGrade), [gradeGroups, passGrade]);

  // ── Risk level ──
  const riskLevel = useMemo(() => {
    if (gradeInfo.totalItemsCount === 0) return 'unknown';

    if (gradeInfo.inFinal) {
      if (gradeInfo.usedFinal) {
        return gradeInfo.score >= 5.0 ? 'safe' : 'failed';
      }
      if (gradeInfo.minimumNeeded === null) return 'unknown';
      if (gradeInfo.minimumNeeded > 10) return 'impossible';
      if (gradeInfo.minimumNeeded > 8) return 'critical';
      if (gradeInfo.minimumNeeded > 6) return 'warning';
      return 'safe';
    }

    if (!gradeInfo.hasMissingItems) {
      return gradeInfo.score >= passGrade ? 'safe' : 'failed';
    }
    
    if (gradeInfo.minimumNeeded === null) return 'unknown';
    if (gradeInfo.minimumNeeded > 10) return 'impossible';
    if (gradeInfo.minimumNeeded > 8) return 'critical';
    if (gradeInfo.minimumNeeded > 6) return 'warning';
    return 'safe';
  }, [gradeInfo, passGrade]);

  const riskConfig = {
    safe: { emoji: '✅', color: colors.success, label: 'Situação Confortável' },
    warning: { emoji: '⚠️', color: colors.warning, label: 'Atenção Redobrada' },
    critical: { emoji: '🚨', color: colors.danger, label: 'Modo Desespero!' },
    impossible: { emoji: '💀', color: colors.danger, label: 'Impossível pela Média' },
    failed: { emoji: '❌', color: colors.danger, label: 'Reprovado por Média' },
    unknown: { emoji: '📊', color: colors.textSecondary, label: 'Sem dados suficientes' },
  };

  const risk = riskConfig[riskLevel];

  const getOrCreateDefaultGroup = () => {
    if (gradeGroups.length > 0) return gradeGroups[0];
    const defaultGroup: GradeGroup = {
      id: generateId('group'),
      name: 'Avaliações',
      weight: 1,
      items: []
    };
    onUpdateSubject({ ...subject, gradeGroups: [defaultGroup] });
    return defaultGroup;
  };

  const openAddItemModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const group = getOrCreateDefaultGroup();
    setTargetGroupId(group.id);
    setNewItemName('');
    setNewItemWeight('1');
    setNewItemMaxGrade('10');
    setNewItemGrade('');
    setNewItemIsFinalExam(false);
    setShowAdvancedItem(false);
    setItemModalVisible(true);
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !targetGroupId) return;

    let parsedGrade: number | undefined = undefined;
    if (newItemGrade.trim()) {
      const g = parseFloat(newItemGrade.replace(',', '.'));
      if (isNaN(g) || g < 0 || g > (parseFloat(newItemMaxGrade) || 10)) {
        Alert.alert('Nota Inválida', `Por favor insira uma nota entre 0 e ${newItemMaxGrade || 10}.`);
        return;
      }
      parsedGrade = g;
    }

    const newItem: GradeItem = {
      id: generateId('item'),
      name: newItemName.trim(),
      weight: Math.max(0.1, parseFloat(newItemWeight) || 1),
      maxGrade: Math.max(1, parseFloat(newItemMaxGrade) || 10),
      grade: parsedGrade,
      isFinalExam: newItemIsFinalExam,
    };

    const updatedGroups = gradeGroups.map(g =>
      g.id === targetGroupId ? { ...g, items: [...g.items, newItem] } : g
    );
    onUpdateSubject({ ...subject, gradeGroups: updatedGroups });
    setItemModalVisible(false);
  };

  const handleRemoveItem = (groupId: string, itemId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const updatedGroups = gradeGroups.map(g =>
      g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
    );
    onUpdateSubject({ ...subject, gradeGroups: updatedGroups });
  };

  const openEditGrade = (groupId: string, itemId: string, currentGrade?: number, currentWeight: number = 1, isFinalExam: boolean = false) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingGroupId(groupId);
    setEditingItemId(itemId);
    setEditGradeValue(currentGrade !== undefined ? String(currentGrade) : '');
    setEditItemWeight(String(currentWeight));
    setEditIsFinalExam(isFinalExam);
    setEditGradeVisible(true);
  };

  const handleSaveGrade = () => {
    if (!editingGroupId || !editingItemId) return;

    let parsedGrade: number | undefined = undefined;
    if (editGradeValue.trim()) {
      const g = parseFloat(editGradeValue.replace(',', '.'));
      if (isNaN(g) || g < 0 || g > 10) {
        Alert.alert('Nota Inválida', 'Por favor insira uma nota entre 0 e 10.');
        return;
      }
      parsedGrade = g;
    }

    const updatedGroups = gradeGroups.map(g => {
      if (g.id !== editingGroupId) return g;
      return {
        ...g,
        items: g.items.map(i =>
          i.id === editingItemId
            ? { 
                ...i, 
                grade: parsedGrade,
                weight: Math.max(0.1, parseFloat(editItemWeight) || 1),
                isFinalExam: editIsFinalExam
              }
            : i
        )
      };
    });
    onUpdateSubject({ ...subject, gradeGroups: updatedGroups });
    setEditGradeVisible(false);
  };

  const calculateFinalExamResult = () => {
    const fg = parseFloat(finalExamGrade.replace(',', '.'));
    if (isNaN(fg) || fg < 0 || fg > 10) {
      Alert.alert('Nota Inválida', 'Insira uma nota entre 0 e 10.');
      return;
    }
    const newAvg = (gradeInfo.score + fg) / 2;
    setFinalExamResult({ avg: newAvg, passed: newAvg >= 5.0 });
  };

  // Minimum needed on final exam to pass
  const minimumFinalGrade = useMemo(() => {
    return Math.max(0, 10 - gradeInfo.score);
  }, [gradeInfo.score]);

  return (
    <View style={styles.container}>
      {/* ── Risk Card ── */}
      <View style={[styles.riskCard, { borderColor: risk.color, backgroundColor: colors.surface }]}>
        <Text style={{ fontSize: 32 }}>{risk.emoji}</Text>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={[styles.riskLabel, { color: risk.color }]}>
            {gradeInfo.usedFinal ? 'Resultado com Final' : risk.label}
          </Text>
          <Text style={[styles.finalGradeInline, { color: colors.text }]}>
            Média: {gradeInfo.score.toFixed(2)} / {gradeInfo.inFinal ? '5.0' : passGrade.toFixed(1)}
          </Text>
          {gradeInfo.inFinal && !gradeInfo.usedFinal && gradeInfo.minimumNeeded !== null && (
            <Text style={{ color: colors.primary, fontSize: 13, marginTop: 4, fontWeight: '700' }}>
              Você precisa tirar {gradeInfo.minimumNeeded.toFixed(1)} na prova final para passar com média 5.0.
            </Text>
          )}
          {!gradeInfo.inFinal && gradeInfo.hasMissingItems && gradeInfo.minimumNeeded !== null && gradeInfo.minimumNeeded <= 10 && (
            <Text style={{ color: risk.color, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
              Você precisa tirar no mínimo {gradeInfo.minimumNeeded.toFixed(1)} nas provas restantes.
            </Text>
          )}
          {!gradeInfo.inFinal && gradeInfo.hasMissingItems && gradeInfo.minimumNeeded !== null && gradeInfo.minimumNeeded > 10 && (
            <Text style={{ color: risk.color, fontSize: 13, marginTop: 4, fontWeight: '600' }}>
              Impossível atingir {passGrade.toFixed(1)} somente pela média. Considere a Prova Final.
            </Text>
          )}
        </View>
      </View>

      {/* ── "Simular Prova Final" Button ── */}
      {(riskLevel === 'failed' || riskLevel === 'impossible' || riskLevel === 'critical' || gradeInfo.inFinal) && (
        <TouchableOpacity
          style={[styles.finalBtn, { backgroundColor: colors.primary }]}
          onPress={() => setFinalExamModalVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 15 }}>🛡️ Simular Prova Final</Text>
          <Text style={{ color: getContrastTextColor(colors.primary), opacity: 0.9, fontSize: 12, marginTop: 4 }}>
            Você precisa de pelo menos {minimumFinalGrade.toFixed(1)} na final para passar.
          </Text>
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 8 }}>
        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0, marginBottom: 0 }]}>Avaliações</Text>
        <TouchableOpacity
          style={[styles.aiFormulaBtn, { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderColor: colors.primary }]}
          onPress={() => setAiCriteriaModalVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>
            ✨ Configurar com IA
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {gradeGroups.reduce((acc, group) => {
          return [...acc, ...group.items.map(item => ({ ...item, groupId: group.id }))];
        }, [] as (GradeItem & { groupId: string })[]).map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.itemSquare, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => openEditGrade(item.groupId, item.id, item.grade, item.weight, item.isFinalExam)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, flex: 1 }} numberOfLines={2}>
                {item.name} {item.isFinalExam && <Text style={{ color: colors.primary, fontSize: 11 }}>(Final)</Text>}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveItem(item.groupId, item.id)} style={{ padding: 4 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>Peso</Text>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.weight}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: '600' }}>Nota</Text>
                <Text style={{
                  color: item.grade !== undefined ? (item.grade >= passGrade ? colors.success : colors.danger) : colors.textSecondary,
                  fontWeight: '800',
                  fontSize: 20
                }}>
                  {item.grade !== undefined ? item.grade.toFixed(1) : '--'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.itemSquare, { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => openAddItemModal()}
          activeOpacity={0.7}
        >
          <Text style={{ color: colors.primary, fontSize: 32 }}>+</Text>
          <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 4 }}>Nova Nota</Text>
        </TouchableOpacity>
      </View>

      {/* ── Modal: Adicionar Nota ── */}
      <Modal visible={itemModalVisible} animationType="fade" transparent onRequestClose={() => setItemModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setItemModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={(e: any) => e.stopPropagation?.()}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalTitle, { color: colors.text }]}>Nova Avaliação / Nota</Text>

                <Text style={[styles.label, { color: colors.text }]}>Nome da Avaliação</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="Ex: P1, Trabalho 1, Seminário"
                  placeholderTextColor={colors.textSecondary}
                  value={newItemName}
                  onChangeText={setNewItemName}
                  autoFocus
                />

                <Text style={[styles.label, { color: colors.text }]}>Nota Obtida (deixe vazio se não realizou)</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                  placeholder="Ex: 8.5"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={newItemGrade}
                  onChangeText={setNewItemGrade}
                />

                <TouchableOpacity 
                  style={{ marginBottom: 15, paddingVertical: 5 }} 
                  onPress={() => setShowAdvancedItem(!showAdvancedItem)}
                >
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>
                    {showAdvancedItem ? 'Ocultar Opções Avançadas' : '⚙️ Opções Avançadas (Peso, Nota Máxima, Final)'}
                  </Text>
                </TouchableOpacity>

                {showAdvancedItem && (
                  <View>
                    <View style={styles.row}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={[styles.label, { color: colors.text }]}>Peso</Text>
                        <TextInput
                          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                          keyboardType="numeric"
                          value={newItemWeight}
                          onChangeText={setNewItemWeight}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.label, { color: colors.text }]}>Nota Máxima</Text>
                        <TextInput
                          style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                          keyboardType="numeric"
                          value={newItemMaxGrade}
                          onChangeText={setNewItemMaxGrade}
                        />
                      </View>
                    </View>
                    <View style={[styles.row, { alignItems: 'center', marginBottom: 15 }]}>
                      <Switch
                        value={newItemIsFinalExam}
                        onValueChange={setNewItemIsFinalExam}
                        trackColor={{ false: colors.border, true: colors.primary }}
                        thumbColor={newItemIsFinalExam ? '#fff' : '#f4f3f4'}
                      />
                      <Text style={{ color: colors.text, marginLeft: 10, fontWeight: '700' }}>É Prova Final / Recuperação?</Text>
                    </View>
                  </View>
                )}

                <View style={[styles.row, { marginTop: 10 }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderWidth: 1, marginRight: 10 }]}
                    onPress={() => setItemModalVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={handleAddItem}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '700' }}>Adicionar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Editar Nota ── */}
      <Modal visible={editGradeVisible} animationType="fade" transparent onRequestClose={() => setEditGradeVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditGradeVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={(e: any) => e.stopPropagation?.()}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalTitle, { color: colors.text }]}>Lançar / Editar Nota</Text>

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text style={[styles.label, { color: colors.text }]}>Peso</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, fontSize: 18, textAlign: 'center' }]}
                      placeholder="Ex: 1"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={editItemWeight}
                      onChangeText={setEditItemWeight}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.label, { color: colors.text }]}>Sua Nota</Text>
                    <TextInput
                      style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, fontSize: 20, textAlign: 'center' }]}
                      placeholder="Ex: 8.5"
                      placeholderTextColor={colors.textSecondary}
                      keyboardType="numeric"
                      value={editGradeValue}
                      onChangeText={setEditGradeValue}
                      autoFocus
                    />
                  </View>
                </View>

                <View style={[styles.row, { alignItems: 'center', marginBottom: 15 }]}>
                  <Switch
                    value={editIsFinalExam}
                    onValueChange={setEditIsFinalExam}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={editIsFinalExam ? '#fff' : '#f4f3f4'}
                  />
                  <Text style={{ color: colors.text, marginLeft: 10, fontWeight: '700' }}>É Prova Final?</Text>
                </View>

                <View style={[styles.row, { marginTop: 20 }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderWidth: 1, marginRight: 10 }]}
                    onPress={() => setEditGradeVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSaveGrade}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '700' }}>Salvar</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── Modal: Prova Final (Universal) ── */}
      <Modal visible={finalExamModalVisible} animationType="fade" transparent onRequestClose={() => setFinalExamModalVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setFinalExamModalVisible(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%', alignItems: 'center' }}>
            <TouchableOpacity activeOpacity={1} style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]} onPress={(e: any) => e.stopPropagation?.()}>
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalTitle, { color: colors.text }]}>🛡️ Simulador de Prova Final</Text>

                <Text style={{ color: colors.textSecondary, marginBottom: 12, lineHeight: 20 }}>
                  Sua média atual é <Text style={{ color: colors.text, fontWeight: '700' }}>{gradeInfo.score.toFixed(2)}</Text>. A média final será calculada como:{'\n'}
                  <Text style={{ fontWeight: '700', color: colors.text }}>(Média + Nota da Final) / 2 ≥ 5.0</Text>
                </Text>
                
                <Text style={{ color: colors.primary, fontWeight: '700', marginBottom: 15 }}>
                  Você precisa de no mínimo {minimumFinalGrade.toFixed(1)} na prova final.
                </Text>

                <Text style={[styles.label, { color: colors.text }]}>Nota que planeja tirar na Final:</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, fontSize: 24, textAlign: 'center' }]}
                  placeholder="Ex: 7.0"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={finalExamGrade}
                  onChangeText={(t: string) => { setFinalExamGrade(t); setFinalExamResult(null); }}
                  autoFocus
                />

                {finalExamResult && (
                  <View style={[styles.finalResultCard, { backgroundColor: finalExamResult.passed ? colors.successLight : colors.dangerLight }]}>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: finalExamResult.passed ? (theme === 'light' ? colors.successDark : colors.success) : (theme === 'light' ? colors.dangerDark : colors.danger) }}>
                      {finalExamResult.passed ? '🎉 APROVADO NA FINAL!' : '😞 Reprovado na Final'}
                    </Text>
                    <Text style={{ color: finalExamResult.passed ? (theme === 'light' ? colors.successDark : colors.success) : (theme === 'light' ? colors.dangerDark : colors.danger), marginTop: 4, fontWeight: '600' }}>
                      Média final resultante: {finalExamResult.avg.toFixed(2)}
                    </Text>
                  </View>
                )}

                <View style={[styles.row, { marginTop: 20 }]}>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.border, borderWidth: 1, marginRight: 10 }]}
                    onPress={() => { setFinalExamModalVisible(false); setFinalExamResult(null); setFinalExamGrade(''); }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>Fechar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={calculateFinalExamResult}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '700' }}>Calcular</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      <AIGradeCriteriaModal
        visible={aiCriteriaModalVisible}
        onClose={() => setAiCriteriaModalVisible(false)}
        subject={subject}
        onApplyCriteria={(updated: Subject) => onUpdateSubject(updated)}
        theme={theme}
      />

      <View style={{ height: 40 }} />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
  },
  aiFormulaBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
  },
  riskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    padding: 18,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  riskLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  finalGradeInline: {
    fontSize: 19,
    fontWeight: '800',
    marginTop: 4,
  },
  finalBtn: {
    padding: 15,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 16,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finalResultCard: {
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  itemSquare: {
    width: '48%',
    minHeight: 128,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    display: 'flex',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1
  }
});

