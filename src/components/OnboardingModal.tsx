import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Platform, StatusBar as RNStatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeType } from '../types';
import { getThemeColors, getContrastTextColor } from '../theme';
import * as Haptics from 'expo-haptics';

interface Props {
  visible: boolean;
  onClose: () => void;
  theme: ThemeType;
}

const GUIDE_SECTIONS = [
  {
    icon: '📅',
    title: 'Agenda com Rolagem Vertical',
    desc: 'Visualize sua Próxima Atividade no topo, o Calendário interativo no meio e suas Tarefas na base. Acesse a Grade Horária Semanal em um toque no cabeçalho.'
  },
  {
    icon: '⏱️',
    title: 'Estudos, Pomodoro & Cronômetro Livre',
    desc: 'Foque nos seus estudos com Pomodoro configurável ou com o Cronômetro Livre progressivo. Acumule tempo de estudo, ganhe XP e mantenha seus Streaks 🔥!'
  },
  {
    icon: '✨',
    title: 'Lumen AI & Professor Socrático',
    desc: 'Tire dúvidas acadêmicas com o Professor IA em modo Socrático ou Resolução Direta. Baixe modelos offline locais (340MB a 2.45GB) ou conecte com o Google Gemini.'
  },
  {
    icon: '📈',
    title: 'Rastreador de CR & Simulador de Metas',
    desc: 'Importe seu histórico escolar em PDF/texto, acompanhe seu CR Ponderado oficial e simule cenários para manter a meta de bolsas e intercâmbio.'
  },
  {
    icon: '🎓',
    title: 'Matriz Curricular & % de Conclusão',
    desc: 'Acompanhe todas as disciplinas do curso separadas por semestres com confirmação limpa de matérias concluídas e barra de progresso do curso.'
  },
  {
    icon: '📊',
    title: 'Controle de Faltas (Margem LDB 75%) & Notas',
    desc: 'Acompanhe médias ponderadas do semestre e monitore faltas em tempo real antes de atingir o limite legal.'
  }
];

export const OnboardingModal: React.FC<Props> = ({ visible, onClose, theme }) => {
  const colors = getThemeColors(theme);
  const styles = getStyles(colors);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
            <Text style={{ fontSize: 15, color: colors.primary, fontWeight: '700' }}>✕ Fechar</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Guia do Lumen</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={[styles.heroIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
              <Text style={{ fontSize: 40 }}>🎓</Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>Bem-vindo ao Lumen!</Text>
            <Text style={{ color: colors.textSecondary, textAlign: 'center', fontSize: 14, marginTop: 6, lineHeight: 20 }}>
              Seu assistente acadêmico inteligente e definitivo para gerenciar aulas, notas, faltas, CR e rotinas de estudo.
            </Text>
          </View>

          {GUIDE_SECTIONS.map((sec, idx) => (
            <View key={idx} style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIconCircle, { backgroundColor: colors.surfaceSubtle }]}>
                  <Text style={{ fontSize: 20 }}>{sec.icon}</Text>
                </View>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{sec.title}</Text>
              </View>
              <Text style={[styles.sectionDesc, { color: colors.textSecondary }]}>{sec.desc}</Text>
            </View>
          ))}

          <TouchableOpacity
            style={[styles.gotItBtn, { backgroundColor: colors.primary }]}
            onPress={handleClose}
            activeOpacity={0.8}
          >
            <Text style={{ color: getContrastTextColor(colors.primary), fontWeight: '800', fontSize: 16 }}>
              Entendi, vamos lá! 🚀
            </Text>
          </TouchableOpacity>

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
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5
  },
  content: {
    padding: 18,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 18,
    marginBottom: 16,
  },
  heroIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5
  },
  sectionCard: {
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  sectionDesc: {
    fontSize: 13,
    lineHeight: 20,
  },
  gotItBtn: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 15,
  }
});

