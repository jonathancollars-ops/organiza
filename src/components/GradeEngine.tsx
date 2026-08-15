import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, Modal } from 'react-native';
import { Subject, GradeGroup, GradeItem, ThemeType } from '../types';
import { getThemeColors } from '../theme';

interface Props {
  subject: Subject;
  onUpdateSubject: (updatedSubject: Subject) => void;
  theme: ThemeType;
}

// ── Calculation helpers ──

interface CalcResult {
  score: number;
  hasMissingItems: boolean;
  missingItemsCount: number;
  totalItemsCount: number;
  /** The minimum average the student needs on ALL remaining items to pass */
  minimumNeeded: number | null;
}

function calculateFinalGrade(gradeGroups: GradeGroup[], passGrade: number): CalcResult {
  if (gradeGroups.length === 0)
    return { score: 0, hasMissingItems: false, missingItemsCount: 0, totalItemsCount: 0, minimumNeeded: null };

  let totalWeight = 0;
  let totalScore = 0;
  let hasMissingItems = false;
  let missingItemsCount = 0;
  let totalItemsCount = 0;

  // Track weighted missing capacity for "minimum needed" calc
  let missingWeightedCapacity = 0; // sum of (weight_group / totalWeight_group * weight_item) for missing items

  gradeGroups.forEach(group => {
    if (group.items.length === 0) return;

    let groupTotalWeight = 0;
    let groupTotalScore = 0;

    group.items.forEach(item => {
      totalItemsCount++;
      groupTotalWeight += item.weight;
      if (item.grade !== undefined) {
        groupTotalScore += (item.grade / item.maxGrade) * 10 * item.weight;
      } else {
        hasMissingItems = true;
        missingItemsCount++;
      }
    });

    const groupAvg = groupTotalWeight > 0 ? groupTotalScore / groupTotalWeight : 0;

    totalWeight += group.weight;
    totalScore += groupAvg * group.weight;
  });

  const finalAvg = totalWeight > 0 ? totalScore / totalWeight : 0;

  // Calculate minimum needed on remaining items
  let minimumNeeded: number | null = null;
  if (hasMissingItems && totalWeight > 0) {
    // We need: (currentContribution + missingContribution) / totalWeight >= passGrade
    // missingContribution = X * missingGroupWeightFraction
    // Simplified: figure out how many "points" are missing
    const neededTotal = passGrade * totalWeight;
    const currentTotal = totalScore;
    const deficit = neededTotal - currentTotal;

    // Calculate effective weight of missing items
    let effectiveMissingWeight = 0;
    gradeGroups.forEach(group => {
      if (group.items.length === 0) return;
      const groupTotalWeight = group.items.reduce((s, i) => s + i.weight, 0);
      group.items.forEach(item => {
        if (item.grade === undefined && groupTotalWeight > 0) {
          effectiveMissingWeight += (item.weight / groupTotalWeight) * group.weight;
        }
      });
    });

    if (effectiveMissingWeight > 0) {
      minimumNeeded = Math.max(0, deficit / effectiveMissingWeight);
    }
  }

  return { score: finalAvg, hasMissingItems, missingItemsCount, totalItemsCount, minimumNeeded };
}

// ── Component ──

export const GradeEngine: React.FC<Props> = ({ subject, onUpdateSubject, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupWeight, setNewGroupWeight] = useState('1');

  // Modal State for adding Grade Item
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [targetGroupId, setTargetGroupId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemWeight, setNewItemWeight] = useState('1');
  const [newItemMaxGrade, setNewItemMaxGrade] = useState('10');
  const [newItemGrade, setNewItemGrade] = useState('');
  const [showAdvancedItem, setShowAdvancedItem] = useState(false);

  // Edit grade modal
  const [editGradeVisible, setEditGradeVisible] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editGradeValue, setEditGradeValue] = useState('');

  const gradeGroups = subject.gradeGroups || [];
  const passGrade = subject.passGrade || 7.0;

  const gradeInfo = useMemo(() => calculateFinalGrade(gradeGroups, passGrade), [gradeGroups, passGrade]);

  // ── Risk level ──
  const riskLevel = useMemo(() => {
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
    safe: { emoji: '✅', color: '#22c55e', label: 'Situação Confortável' },
    warning: { emoji: '⚠️', color: '#f59e0b', label: 'Atenção Redobrada' },
    critical: { emoji: '🚨', color: '#ef4444', label: 'Modo Desespero!' },
    impossible: { emoji: '💀', color: '#7f1d1d', label: 'Impossível pela Média' },
    failed: { emoji: '❌', color: '#ef4444', label: 'Reprovado por Média' },
    unknown: { emoji: '📊', color: colors.textSecondary, label: 'Sem dados suficientes' },
  };

  const risk = riskConfig[riskLevel];

  // ── Handlers ──

  // We remove handleAddGroup and handleRemoveGroup, since we are hiding groups from the UI

  const getOrCreateDefaultGroup = () => {
    if (gradeGroups.length > 0) return gradeGroups[0];
    const defaultGroup = {
      id: `group_${Date.now()}`,
      name: 'Avaliações',
      weight: 1,
      items: []
    };
    onUpdateSubject({ ...subject, gradeGroups: [defaultGroup] });
    return defaultGroup;
  };

  const openAddItemModal = () => {
    const group = getOrCreateDefaultGroup();
    setTargetGroupId(group.id);
    setNewItemName('');
    setNewItemWeight('1');
    setNewItemMaxGrade('10');
    setNewItemGrade('');
    setShowAdvancedItem(false);
    setItemModalVisible(true);
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !targetGroupId) return;
    const newItem: GradeItem = {
      id: `item_${Date.now()}`,
      name: newItemName,
      weight: parseFloat(newItemWeight) || 1,
      maxGrade: parseFloat(newItemMaxGrade) || 10,
      grade: newItemGrade.trim() ? parseFloat(newItemGrade) : undefined,
    };
    const updatedGroups = gradeGroups.map(g =>
      g.id === targetGroupId ? { ...g, items: [...g.items, newItem] } : g
    );
    onUpdateSubject({ ...subject, gradeGroups: updatedGroups });
    setItemModalVisible(false);
  };

  const handleRemoveItem = (groupId: string, itemId: string) => {
    const updatedGroups = gradeGroups.map(g =>
      g.id === groupId ? { ...g, items: g.items.filter(i => i.id !== itemId) } : g
    );
    onUpdateSubject({ ...subject, gradeGroups: updatedGroups });
  };

  const [editItemWeight, setEditItemWeight] = useState('1');

  const openEditGrade = (groupId: string, itemId: string, currentGrade?: number, currentWeight: number = 1) => {
    setEditingGroupId(groupId);
    setEditingItemId(itemId);
    setEditGradeValue(currentGrade !== undefined ? String(currentGrade) : '');
    setEditItemWeight(String(currentWeight));
    setEditGradeVisible(true);
  };

  const handleSaveGrade = () => {
    if (!editingGroupId || !editingItemId) return;
    const updatedGroups = gradeGroups.map(g => {
      if (g.id !== editingGroupId) return g;
      return {
        ...g,
        items: g.items.map(i =>
          i.id === editingItemId
            ? { 
                ...i, 
                grade: editGradeValue.trim() ? parseFloat(editGradeValue) : undefined,
                weight: parseFloat(editItemWeight) || 1
              }
            : i
        )
      };
    });
    onUpdateSubject({ ...subject, gradeGroups: updatedGroups });
    setEditGradeVisible(false);
  };

  // ── "Ir para Final" (Recovery exam) ──
  const handleFinalExam = () => {
    Alert.prompt
      ? Alert.prompt(
          'Prova Final',
          `Qual foi sua nota na prova final? A média será recalculada como (Média + Final) / 2. Você precisa de pelo menos ${passGrade.toFixed(1)}.`,
          (text) => {
            const finalGrade = parseFloat(text);
            if (isNaN(finalGrade)) return;
            const newAvg = (gradeInfo.score + finalGrade) / 2;
            Alert.alert(
              'Resultado da Final',
              `Sua média final ficou: ${newAvg.toFixed(2)}\n${newAvg >= passGrade ? '🎉 APROVADO!' : '😞 Reprovado.'}`,
            );
          },
          'plain-text',
          '',
          'numeric'
        )
      : (() => {
          // Android fallback — use a simple state-based input since Alert.prompt is iOS only
          setFinalExamModalVisible(true);
        })();
  };

  const [finalExamModalVisible, setFinalExamModalVisible] = useState(false);
  const [finalExamGrade, setFinalExamGrade] = useState('');
  const [finalExamResult, setFinalExamResult] = useState<{ avg: number; passed: boolean } | null>(null);

  const calculateFinalExamResult = () => {
    const fg = parseFloat(finalExamGrade);
    if (isNaN(fg)) return;
    const newAvg = (gradeInfo.score + fg) / 2;
    setFinalExamResult({ avg: newAvg, passed: newAvg >= passGrade });
  };

  // Minimum needed on final exam to pass
  const minimumFinalGrade = useMemo(() => {
    // (score + X) / 2 >= passGrade  →  X >= 2*passGrade - score
    return Math.max(0, 2 * passGrade - gradeInfo.score);
  }, [gradeInfo.score, passGrade]);

  return (
    <View style={styles.container}>
      {/* ── Risk Card (Ponto 1 — Previsão de Risco) ── */}
      <View style={[styles.riskCard, { borderColor: risk.color }]}>
        <Text style={{ fontSize: 32 }}>{risk.emoji}</Text>
        <View style={{ flex: 1, marginLeft: 15 }}>
          <Text style={[styles.riskLabel, { color: risk.color }]}>{risk.label}</Text>
          <Text style={[styles.finalGradeInline, { color: colors.text }]}>
            Média: {gradeInfo.score.toFixed(2)} / {passGrade.toFixed(1)}
          </Text>
          {gradeInfo.hasMissingItems && gradeInfo.minimumNeeded !== null && gradeInfo.minimumNeeded <= 10 && (
            <Text style={{ color: risk.color, fontSize: 13, marginTop: 4 }}>
              Você precisa tirar no mínimo {gradeInfo.minimumNeeded.toFixed(1)} nas provas restantes.
            </Text>
          )}
          {gradeInfo.hasMissingItems && gradeInfo.minimumNeeded !== null && gradeInfo.minimumNeeded > 10 && (
            <Text style={{ color: risk.color, fontSize: 13, marginTop: 4 }}>
              Impossível atingir {passGrade.toFixed(1)} somente pela média. Considere a Prova Final.
            </Text>
          )}
        </View>
      </View>

      {/* ── "Ir para a Final" Button (Ponto 5) ── */}
      {(riskLevel === 'failed' || riskLevel === 'impossible' || riskLevel === 'critical') && (
        <TouchableOpacity
          style={[styles.finalBtn, { backgroundColor: '#7c3aed' }]}
          onPress={handleFinalExam}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>🛡️ Simular Prova Final</Text>
          <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 4 }}>
            Você precisa de pelo menos {minimumFinalGrade.toFixed(1)} na final para passar.
          </Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 20 }]}>Avaliações</Text>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {gradeGroups.reduce((acc, group) => {
          return [...acc, ...group.items.map(item => ({ ...item, groupId: group.id }))];
        }, [] as (GradeItem & { groupId: string })[]).map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.itemSquare, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => openEditGrade(item.groupId, item.id, item.grade, item.weight)}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, flex: 1 }} numberOfLines={2}>
                {item.name}
              </Text>
              <TouchableOpacity onPress={() => handleRemoveItem(item.groupId, item.id)} style={{ marginLeft: 5, padding: 5 }}>
                <Text style={{ color: colors.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Peso</Text>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>{item.weight}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Nota</Text>
                <Text style={{ color: item.grade !== undefined ? colors.primary : colors.textSecondary, fontWeight: 'bold', fontSize: 22 }}>
                  {item.grade !== undefined ? item.grade : '--'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.itemSquare, { backgroundColor: 'transparent', borderColor: colors.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' }]}
          onPress={() => openAddItemModal()}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 32 }}>+</Text>
          <Text style={{ color: colors.textSecondary, fontWeight: 'bold', marginTop: 5 }}>Nova Nota</Text>
        </TouchableOpacity>
      </View>



      {/* ── Modal: Adicionar Nota ── */}
      <Modal visible={itemModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Nova Nota Avulsa</Text>

            <Text style={[styles.label, { color: colors.text }]}>Nome da Avaliação</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
              placeholder="Ex: P1"
              placeholderTextColor={colors.textSecondary}
              value={newItemName}
              onChangeText={setNewItemName}
            />

            <Text style={[styles.label, { color: colors.text }]}>Nota Tirada (deixe vazio se ainda não fez)</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
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
              <Text style={{ color: colors.primary, fontWeight: 'bold' }}>
                {showAdvancedItem ? 'Ocultar Opções Avançadas' : '⚙️ Opções Avançadas (Pesos, etc)'}
              </Text>
            </TouchableOpacity>

            {showAdvancedItem && (
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.label, { color: colors.text }]}>Peso Interno</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
                    keyboardType="numeric"
                    value={newItemWeight}
                    onChangeText={setNewItemWeight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.text }]}>Nota Máxima</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, backgroundColor: colors.surface }]}
                    keyboardType="numeric"
                    value={newItemMaxGrade}
                    onChangeText={setNewItemMaxGrade}
                  />
                </View>
              </View>
            )}

            <View style={[styles.row, { marginTop: 10 }]}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.border, marginRight: 10 }]} onPress={() => setItemModalVisible(false)}>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleAddItem}>
                <Text style={{ color: '#000', fontWeight: 'bold' }}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Editar Nota ── */}
      <Modal visible={editGradeVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Lançar / Editar Nota</Text>

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={[styles.label, { color: colors.text }]}>Peso da Avaliação</Text>
                <TextInput
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface, fontSize: 20, textAlign: 'center' }]}
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
                  style={[styles.input, { color: colors.text, backgroundColor: colors.surface, fontSize: 20, textAlign: 'center' }]}
                  placeholder="Ex: 8.5"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={editGradeValue}
                  onChangeText={setEditGradeValue}
                  autoFocus
                />
              </View>
            </View>

            <View style={[styles.row, { marginTop: 20 }]}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.border, marginRight: 10 }]} onPress={() => setEditGradeVisible(false)}>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary }]} onPress={handleSaveGrade}>
                <Text style={{ color: '#000', fontWeight: 'bold' }}>Salvar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal: Prova Final (Android fallback) ── */}
      <Modal visible={finalExamModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>🛡️ Simulador de Prova Final</Text>

            <Text style={{ color: colors.textSecondary, marginBottom: 15 }}>
              Sua média atual é {gradeInfo.score.toFixed(2)}. A média final será calculada como:{'\n'}
              <Text style={{ fontWeight: 'bold', color: colors.text }}>(Média + Nota da Final) / 2</Text>
            </Text>
            <Text style={{ color: '#7c3aed', fontWeight: 'bold', marginBottom: 15 }}>
              Você precisa de pelo menos {minimumFinalGrade.toFixed(1)} na final.
            </Text>

            <Text style={[styles.label, { color: colors.text }]}>Nota na Prova Final</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, fontSize: 24, textAlign: 'center' }]}
              placeholder="Ex: 7.0"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={finalExamGrade}
              onChangeText={(t) => { setFinalExamGrade(t); setFinalExamResult(null); }}
              autoFocus
            />

            {finalExamResult && (
              <View style={[styles.finalResultCard, { backgroundColor: finalExamResult.passed ? '#dcfce7' : '#fee2e2' }]}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: finalExamResult.passed ? '#166534' : '#991b1b' }}>
                  {finalExamResult.passed ? '🎉 APROVADO!' : '😞 Reprovado'}
                </Text>
                <Text style={{ color: finalExamResult.passed ? '#166534' : '#991b1b', marginTop: 5 }}>
                  Média final: {finalExamResult.avg.toFixed(2)}
                </Text>
              </View>
            )}

            <View style={[styles.row, { marginTop: 20 }]}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.border, marginRight: 10 }]} onPress={() => { setFinalExamModalVisible(false); setFinalExamResult(null); setFinalExamGrade(''); }}>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>Fechar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#7c3aed' }]} onPress={calculateFinalExamResult}>
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Calcular</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={{ height: 100 }} />
    </View>
  );
};

const getStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  riskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 16,
    padding: 20,
    marginBottom: 25,
  },
  riskLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  finalGradeInline: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  finalBtn: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  groupCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  groupName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 12,
  },
  addItemBtn: {
    marginTop: 15,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  addGroupContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginTop: 10,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
    fontWeight: 'bold',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  input: {
    height: 48,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    marginBottom: 15,
  },
  saveBtn: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 5,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finalResultCard: {
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  itemSquare: {
    width: '48%',
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 15,
    display: 'flex',
    flexDirection: 'column',
  }
});
