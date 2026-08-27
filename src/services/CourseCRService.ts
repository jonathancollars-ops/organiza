import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Subject,
  CourseProgressData,
  CourseSemester,
  CourseHistorySubject,
  CRSimulationScenario
} from '../types';
import { generateId } from '../utils';
import { calculateFinalGrade } from '../components/GradeEngine';

const COURSE_PROGRESS_STORAGE_KEY = '@lumen_course_progress';

export const DEFAULT_CURRICULUM_TEMPLATE: CourseProgressData = {
  courseName: 'Graduação',
  targetCR: 8.5,
  baselineCR: 8.0,
  totalRequiredCredits: 200,
  completedCredits: 80,
  totalRequiredHours: 3200,
  completedHours: 1280,
  semesters: [
    {
      semesterNumber: 1,
      title: '1º Semestre',
      subjects: [
        { id: 'sub_1_1', name: 'Cálculo Diferencial e Integral I', code: 'MAT101', credits: 5, hours: 80, isCompleted: true, grade: 8.5 },
        { id: 'sub_1_2', name: 'Geometria Analítica e Álgebra Linear', code: 'MAT102', credits: 4, hours: 60, isCompleted: true, grade: 7.8 },
        { id: 'sub_1_3', name: 'Introdução à Programação', code: 'CC101', credits: 4, hours: 60, isCompleted: true, grade: 9.0 },
        { id: 'sub_1_4', name: 'Física Geral I', code: 'FIS101', credits: 4, hours: 60, isCompleted: true, grade: 7.2 },
        { id: 'sub_1_5', name: 'Metodologia Científica', code: 'HUM101', credits: 2, hours: 30, isCompleted: true, grade: 9.5 }
      ]
    },
    {
      semesterNumber: 2,
      title: '2º Semestre',
      subjects: [
        { id: 'sub_2_1', name: 'Cálculo Diferencial e Integral II', code: 'MAT201', credits: 5, hours: 80, isCompleted: true, grade: 8.0 },
        { id: 'sub_2_2', name: 'Estruturas de Dados', code: 'CC201', credits: 4, hours: 60, isCompleted: true, grade: 8.7 },
        { id: 'sub_2_3', name: 'Física Geral II', code: 'FIS201', credits: 4, hours: 60, isCompleted: true, grade: 7.5 },
        { id: 'sub_2_4', name: 'Circuitos Digitais', code: 'ENG201', credits: 4, hours: 60, isCompleted: true, grade: 8.2 }
      ]
    },
    {
      semesterNumber: 3,
      title: '3º Semestre',
      subjects: [
        { id: 'sub_3_1', name: 'Cálculo III', code: 'MAT301', credits: 4, hours: 60, isCompleted: true, grade: 7.9 },
        { id: 'sub_3_2', name: 'Algoritmos Avançados', code: 'CC301', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_3_3', name: 'Eletromagnetismo', code: 'FIS301', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_3_4', name: 'Probabilidade e Estatística', code: 'EST301', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 4,
      title: '4º Semestre',
      subjects: [
        { id: 'sub_4_1', name: 'Sistemas Operacionais', code: 'CC401', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_4_2', name: 'Bancos de Dados', code: 'CC402', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_4_3', name: 'Redes de Computadores', code: 'CC403', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_4_4', name: 'Engenharia de Software', code: 'CC404', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 5,
      title: '5º Semestre',
      subjects: [
        { id: 'sub_5_1', name: 'Inteligência Artificial', code: 'CC501', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_5_2', name: 'Compiladores', code: 'CC502', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_5_3', name: 'Sistemas Distribuídos', code: 'CC503', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 6,
      title: '6º Semestre',
      subjects: [
        { id: 'sub_6_1', name: 'Segurança da Informação', code: 'CC601', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_6_2', name: 'Computação Gráfica', code: 'CC602', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_6_3', name: 'Otimização e Pesquisa Operacional', code: 'MAT601', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 7,
      title: '7º Semestre',
      subjects: [
        { id: 'sub_7_1', name: 'Trabalho de Conclusão de Curso I', code: 'TCC701', credits: 3, hours: 45, isCompleted: false },
        { id: 'sub_7_2', name: 'Estágio Supervisionado', code: 'EST701', credits: 6, hours: 120, isCompleted: false },
        { id: 'sub_7_3', name: 'Tópicos Especiais I', code: 'TOP701', credits: 4, hours: 60, isCompleted: false }
      ]
    },
    {
      semesterNumber: 8,
      title: '8º Semestre',
      subjects: [
        { id: 'sub_8_1', name: 'Trabalho de Conclusão de Curso II', code: 'TCC801', credits: 4, hours: 60, isCompleted: false },
        { id: 'sub_8_2', name: 'Empreendedorismo e Inovação', code: 'ADM801', credits: 2, hours: 30, isCompleted: false },
        { id: 'sub_8_3', name: 'Ética e Cidadania', code: 'HUM801', credits: 2, hours: 30, isCompleted: false }
      ]
    }
  ]
};

export class CourseCRService {
  /**
   * Calculates the weighted cumulative Grade Point Average (CR / GPA) from completed subjects.
   * Formula: CR = Sum(Grade * Credits) / Sum(Credits)
   */
  static calculateHistoricalCR(data: CourseProgressData): number {
    if (!data || !Array.isArray(data.semesters)) {
      return data?.baselineCR || 0;
    }

    let totalWeightedScore = 0;
    let totalCredits = 0;

    data.semesters.forEach(sem => {
      if (sem && Array.isArray(sem.subjects)) {
        sem.subjects.forEach(sub => {
          if (sub && sub.isCompleted && typeof sub.grade === 'number' && !isNaN(sub.grade)) {
            const credits = (typeof sub.credits === 'number' && sub.credits > 0) ? sub.credits : 1;
            totalWeightedScore += sub.grade * credits;
            totalCredits += credits;
          }
        });
      }
    });

    if (totalCredits === 0) {
      return data.baselineCR || 0;
    }

    const calculated = totalWeightedScore / totalCredits;
    return isNaN(calculated) ? (data.baselineCR || 0) : Number(calculated.toFixed(2));
  }

  /**
   * Calculates degree completion progress metrics (Credits and % Completion).
   */
  static calculateDegreeProgress(data: CourseProgressData): {
    completedCredits: number;
    totalRequiredCredits: number;
    completionPercentage: number;
    completedSubjectsCount: number;
    totalSubjectsCount: number;
  } {
    if (!data || !Array.isArray(data.semesters)) {
      return {
        completedCredits: data?.completedCredits || 0,
        totalRequiredCredits: data?.totalRequiredCredits || 200,
        completionPercentage: 0,
        completedSubjectsCount: 0,
        totalSubjectsCount: 0
      };
    }

    let completedCredits = 0;
    let totalCredits = 0;
    let completedSubjectsCount = 0;
    let totalSubjectsCount = 0;

    data.semesters.forEach(sem => {
      if (sem && Array.isArray(sem.subjects)) {
        sem.subjects.forEach(sub => {
          if (sub) {
            const credits = (typeof sub.credits === 'number' && sub.credits > 0)
              ? sub.credits
              : (sub.hours ? Math.round(sub.hours / 15) : 4);
            totalCredits += credits;
            totalSubjectsCount++;

            if (sub.isCompleted) {
              completedCredits += credits;
              completedSubjectsCount++;
            }
          }
        });
      }
    });

    const targetTotalCredits = (data.totalRequiredCredits && data.totalRequiredCredits > 0)
      ? data.totalRequiredCredits
      : Math.max(totalCredits, 1);

    const effectiveCompleted = totalSubjectsCount > 0
      ? completedCredits
      : Math.max(completedCredits, data.completedCredits || 0);

    const percentage = Math.min((effectiveCompleted / targetTotalCredits) * 100, 100.0);

    return {
      completedCredits: effectiveCompleted,
      totalRequiredCredits: targetTotalCredits,
      completionPercentage: isNaN(percentage) ? 0 : Number(percentage.toFixed(1)),
      completedSubjectsCount,
      totalSubjectsCount
    };
  }

  /**
   * Simulates dynamic CR scenarios based on current semester active subjects.
   */
  static simulateCRScenarios(
    courseData: CourseProgressData,
    currentSemesterSubjects: Subject[] = []
  ): {
    currentCR: number;
    scenarios: CRSimulationScenario[];
  } {
    const safeData = (courseData && Array.isArray(courseData.semesters))
      ? courseData
      : DEFAULT_CURRICULUM_TEMPLATE;

    const historicalCR = this.calculateHistoricalCR(safeData);

    let pastCredits = 0;
    let pastWeightedSum = 0;

    safeData.semesters.forEach(sem => {
      if (sem && Array.isArray(sem.subjects)) {
        sem.subjects.forEach(sub => {
          if (sub && sub.isCompleted && typeof sub.grade === 'number' && !isNaN(sub.grade)) {
            const credits = sub.credits > 0 ? sub.credits : 4;
            pastWeightedSum += sub.grade * credits;
            pastCredits += credits;
          }
        });
      }
    });

    if (pastCredits === 0) {
      pastCredits = safeData.completedCredits || 40;
      pastWeightedSum = historicalCR * pastCredits;
    }

    // Evaluate current semester subjects
    let currentSemesterCredits = 0;
    let currentSemesterWorstSum = 0; // If future exams get 0
    let currentSemesterBestSum = 0; // If future exams get 10
    let currentSemesterEstimatedSum = 0;

    const safeSubjects = Array.isArray(currentSemesterSubjects) ? currentSemesterSubjects : [];

    safeSubjects.forEach(sub => {
      if (sub) {
        const credits = sub.workloadHours ? Math.round(sub.workloadHours / 20) : 4;
        currentSemesterCredits += credits;

        if (sub.gradeGroups && sub.gradeGroups.length > 0) {
          const calc = calculateFinalGrade(sub.gradeGroups, sub.passGrade || 7.0);
          const currentScore = typeof calc.score === 'number' && !isNaN(calc.score) ? calc.score : (sub.passGrade || 7.0);
          
          currentSemesterEstimatedSum += currentScore * credits;
          currentSemesterWorstSum += (calc.hasMissingItems ? currentScore * 0.7 : currentScore) * credits;
          currentSemesterBestSum += 10.0 * credits;
        } else {
          // No grades entered yet
          const fallback = typeof sub.passGrade === 'number' ? sub.passGrade : 7.0;
          currentSemesterEstimatedSum += fallback * credits;
          currentSemesterWorstSum += (fallback * 0.5) * credits;
          currentSemesterBestSum += 10.0 * credits;
        }
      }
    });

    const totalEstimatedCredits = pastCredits + currentSemesterCredits;

    // Projected CR Calculations
    const realisticCR = totalEstimatedCredits > 0
      ? Number(((pastWeightedSum + currentSemesterEstimatedSum) / totalEstimatedCredits).toFixed(2))
      : historicalCR;

    const worstCaseCR = totalEstimatedCredits > 0
      ? Number(((pastWeightedSum + currentSemesterWorstSum) / totalEstimatedCredits).toFixed(2))
      : historicalCR;

    const bestCaseCR = totalEstimatedCredits > 0
      ? Number(((pastWeightedSum + currentSemesterBestSum) / totalEstimatedCredits).toFixed(2))
      : historicalCR;

    const targetCR = safeData.targetCR || 8.5;
    const targetTotalWeighted = targetCR * totalEstimatedCredits;
    const neededCurrentWeighted = targetTotalWeighted - pastWeightedSum;
    const neededInCurrent = currentSemesterCredits > 0 ? (neededCurrentWeighted / currentSemesterCredits) : targetCR;
    const neededFormatted = isNaN(neededInCurrent) ? targetCR.toFixed(1) : neededInCurrent.toFixed(1);

    const scenarios: CRSimulationScenario[] = [
      {
        title: '📊 Cenário Realista (Manter Médias Atuais)',
        projectedCR: isNaN(realisticCR) ? historicalCR : realisticCR,
        difference: Number(((isNaN(realisticCR) ? historicalCR : realisticCR) - historicalCR).toFixed(2)),
        description: 'Mantendo o ritmo e notas parciais calculadas nas disciplinas deste período.',
        type: 'realistic',
        badgeColor: '#3B82F6'
      },
      {
        title: '🛑 Pior Caso (Parar Hoje / Nota Zero)',
        projectedCR: isNaN(worstCaseCR) ? historicalCR : worstCaseCR,
        difference: Number(((isNaN(worstCaseCR) ? historicalCR : worstCaseCR) - historicalCR).toFixed(2)),
        description: 'Se você não realizar mais nenhuma avaliação e tirar zero nas provas restantes.',
        type: 'worst_case',
        badgeColor: '#EF4444'
      },
      {
        title: `🎯 Meta Desejada (CR ${targetCR})`,
        projectedCR: targetCR,
        difference: Number((targetCR - historicalCR).toFixed(2)),
        description: neededInCurrent > 10 
          ? `Alvo matematicamente inalcançável neste semestre (exigiria média ${neededFormatted}).`
          : `Você precisa de média ponderada de no mínimo ${neededFormatted} nas matérias deste semestre.`,
        type: 'target',
        badgeColor: '#10B981'
      },
      {
        title: '🚀 Melhor Caso (Nota 10 em tudo)',
        projectedCR: isNaN(bestCaseCR) ? historicalCR : bestCaseCR,
        difference: Number(((isNaN(bestCaseCR) ? historicalCR : bestCaseCR) - historicalCR).toFixed(2)),
        description: 'Se gabaritar todas as provas e trabalhos pendentes até o final do semestre.',
        type: 'best_case',
        badgeColor: '#8B5CF6'
      }
    ];

    return {
      currentCR: historicalCR,
      scenarios
    };
  }

  /**
   * Toggles completion status of a subject in the curriculum matrix.
   */
  static toggleSubjectCompletion(data: CourseProgressData, subjectId: string): CourseProgressData {
    const safeData = (data && Array.isArray(data.semesters)) ? data : DEFAULT_CURRICULUM_TEMPLATE;
    const updatedSemesters = safeData.semesters.map(sem => {
      const updatedSubjects = (sem.subjects || []).map(sub => {
        if (sub.id === subjectId) {
          return { ...sub, isCompleted: !sub.isCompleted };
        }
        return sub;
      });
      return { ...sem, subjects: updatedSubjects };
    });

    const progress = this.calculateDegreeProgress({ ...safeData, semesters: updatedSemesters });

    return {
      ...safeData,
      semesters: updatedSemesters,
      completedCredits: progress.completedCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Adds a new subject to a specific semester in the curriculum matrix.
   */
  static addSubjectToSemester(
    data: CourseProgressData,
    semesterNumber: number,
    subject: { name: string; credits: number; hours?: number; code?: string; isCompleted?: boolean }
  ): CourseProgressData {
    const safeData = (data && Array.isArray(data.semesters)) ? data : DEFAULT_CURRICULUM_TEMPLATE;
    const newSubject: CourseHistorySubject = {
      id: generateId('subj'),
      name: subject.name.trim(),
      code: subject.code?.trim(),
      credits: subject.credits > 0 ? subject.credits : 4,
      hours: subject.hours || subject.credits * 15,
      isCompleted: !!subject.isCompleted
    };

    let semesterFound = false;
    const updatedSemesters = safeData.semesters.map(sem => {
      if (sem.semesterNumber === semesterNumber) {
        semesterFound = true;
        return {
          ...sem,
          subjects: [...(sem.subjects || []), newSubject]
        };
      }
      return sem;
    });

    if (!semesterFound) {
      updatedSemesters.push({
        semesterNumber,
        title: `${semesterNumber}º Semestre`,
        subjects: [newSubject]
      });
      updatedSemesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    const progress = this.calculateDegreeProgress({ ...safeData, semesters: updatedSemesters });

    return {
      ...safeData,
      semesters: updatedSemesters,
      completedCredits: progress.completedCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Calculates required final exam score based on standard academic regulations:
   * Rule: (Average * 6 + FinalExam * 4) / 10 >= 5.0  (or target passGrade)
   * Required Final = (PassGrade * 10 - Average * 6) / 4
   */
  static calculateFinalExamRequirement(currentAverage: number, passGrade: number = 7.0): {
    neededGrade: number;
    status: 'approved' | 'final_exam' | 'reproved';
    message: string;
    badgeColor: string;
  } {
    const avg = typeof currentAverage === 'number' && !isNaN(currentAverage) ? currentAverage : 0;
    const pass = typeof passGrade === 'number' && !isNaN(passGrade) ? passGrade : 7.0;

    if (avg >= pass) {
      return {
        neededGrade: 0,
        status: 'approved',
        message: `Parabéns! Média ${avg.toFixed(1)} atingiu ou superou o corte de aprovação direta (${pass.toFixed(1)}).`,
        badgeColor: '#10B981'
      };
    }

    // Direct reproval if average is below minimum exam threshold (usually 4.0 or 3.0)
    const minFinalThreshold = pass >= 7.0 ? 4.0 : 3.0;
    if (avg < minFinalThreshold) {
      return {
        neededGrade: 10.0,
        status: 'reproved',
        message: `Média ${avg.toFixed(1)} abaixo do mínimo de ${minFinalThreshold.toFixed(1)} para ter direito à Prova Final.`,
        badgeColor: '#EF4444'
      };
    }

    // Standard formula: Final Exam needed to reach 5.0 overall
    const targetOverall = 5.0;
    const needed = (targetOverall * 10 - avg * 6) / 4;
    const clampedNeeded = Math.max(0, Math.min(10.0, Number(needed.toFixed(1))));

    return {
      neededGrade: clampedNeeded,
      status: 'final_exam',
      message: `Você precisa tirar ${clampedNeeded.toFixed(1)} na Prova Final para fechar a média ponderada 5.0.`,
      badgeColor: '#F59E0B'
    };
  }

  /**
   * Parses raw copy-pasted academic transcript text (SIGAA, Sophia, TOTVS, etc.)
   */
  static parseHistoryText(rawText: string, existingData?: CourseProgressData): CourseProgressData {
    const base = (existingData && Array.isArray(existingData.semesters))
      ? existingData
      : DEFAULT_CURRICULUM_TEMPLATE;

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const updatedSemesters = base.semesters.map(sem => ({
      ...sem,
      subjects: [...(sem.subjects || [])]
    }));

    let extractedCR: number | null = null;
    const crMatch = rawText.match(/(?:cr|coeficiente|ira|rendimento|gpa|media geral)[\s:=-]+([0-9]+[.,][0-9]+)/i);
    if (crMatch && crMatch[1]) {
      const parsed = parseFloat(crMatch[1].replace(',', '.'));
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 10) {
        extractedCR = parsed;
      }
    }

    lines.forEach(line => {
      const isApproved = /aprovado|aprovada|aprov|concluido|concluído|dispensado|dispensa|isento|aproveitado|aproveitamento/i.test(line);

      let grade: number | undefined = undefined;
      const gradeMatches = line.match(/([0-9]{1,2}[.,][0-9]{1,2})/g);
      if (gradeMatches) {
        for (const match of gradeMatches) {
          const num = parseFloat(match.replace(',', '.'));
          if (!isNaN(num) && num >= 0 && num <= 10.0) {
            grade = num;
          }
        }
      }

      updatedSemesters.forEach(sem => {
        sem.subjects.forEach(sub => {
          const normalizedLine = line.toLowerCase();
          const normalizedSub = sub.name.toLowerCase();
          const words = normalizedSub.split(' ').filter(w => w.length > 3);
          const matchCount = words.filter(w => normalizedLine.includes(w)).length;

          if (matchCount >= Math.min(2, words.length) || (sub.code && normalizedLine.includes(sub.code.toLowerCase()))) {
            if (isApproved || (grade !== undefined && grade >= 5.0)) {
              sub.isCompleted = true;
              if (grade !== undefined) sub.grade = grade;
            }
          }
        });
      });
    });

    const progress = this.calculateDegreeProgress({ ...base, semesters: updatedSemesters });
    return {
      ...base,
      baselineCR: typeof extractedCR === 'number' ? extractedCR : base.baselineCR,
      semesters: updatedSemesters,
      completedCredits: progress.completedCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Parses a full Curriculum Flowchart (Fluxograma / Matriz Curricular) organized by semesters.
   */
  static parseCurriculumMatrixText(rawText: string, existingData?: CourseProgressData): CourseProgressData {
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const parsedSemesters: CourseSemester[] = [];
    let currentSemesterNumber = 1;
    let currentSubjects: CourseHistorySubject[] = [];

    lines.forEach(line => {
      const semesterHeaderMatch = line.match(/(?:(\d+)[ºª°]?\s*(?:semestre|periodo|período|fase|modulo|módulo|etapa)|(?:semestre|periodo|período|fase|modulo|módulo|etapa)\s*(\d+))/i);

      if (semesterHeaderMatch) {
        if (currentSubjects.length > 0) {
          parsedSemesters.push({
            semesterNumber: currentSemesterNumber,
            title: `${currentSemesterNumber}º Semestre`,
            subjects: currentSubjects
          });
          currentSubjects = [];
        }
        const parsedNum = parseInt(semesterHeaderMatch[1] || semesterHeaderMatch[2], 10);
        currentSemesterNumber = !isNaN(parsedNum) && parsedNum > 0 ? parsedNum : currentSemesterNumber + 1;
        return;
      }

      const isApproved = /aprovado|aprovada|concluído|concluída|feito|feita|dispensado|isento|aprov/i.test(line);

      const cleanName = line
        .replace(/MAT\d+|FIS\d+|CC\d+|ENG\d+|[A-Z]{2,4}\d{3,4}/g, '')
        .replace(/\b\d+\s*(h|horas|ch|cr|créditos)\b/gi, '')
        .replace(/aprovado|aprovada|concluído|concluída|reprovado|reprovada|trancado|isento/gi, '')
        .replace(/[0-9.,]+/g, '')
        .replace(/[-|–:()]/g, '')
        .trim();

      if (cleanName.length >= 3) {
        let credits = 4;
        const crUnitMatch = line.match(/(\d+)\s*(?:cr|créditos|cred|crédito)\b/i);
        const hoursUnitMatch = line.match(/(\d+)\s*(?:h|horas|ch)\b/i);

        if (crUnitMatch) {
          credits = parseInt(crUnitMatch[1], 10);
        } else if (hoursUnitMatch) {
          credits = Math.max(1, Math.round(parseInt(hoursUnitMatch[1], 10) / 15));
        }

        let grade: number | undefined = undefined;
        const gradeMatches = line.match(/\b([0-9]{1,2}[.,][0-9]{1,2})\b/g);
        if (gradeMatches) {
          for (const match of gradeMatches) {
            const num = parseFloat(match.replace(',', '.'));
            if (!isNaN(num) && num >= 0 && num <= 10.0) {
              grade = num;
            }
          }
        }

        currentSubjects.push({
          id: generateId('flow'),
          name: cleanName,
          credits,
          hours: credits * 15,
          isCompleted: isApproved || (grade !== undefined && grade >= 5.0),
          grade
        });
      }
    });

    if (currentSubjects.length > 0) {
      parsedSemesters.push({
        semesterNumber: currentSemesterNumber,
        title: `${currentSemesterNumber}º Semestre`,
        subjects: currentSubjects
      });
    }

    const base = (existingData && Array.isArray(existingData.semesters))
      ? existingData
      : DEFAULT_CURRICULUM_TEMPLATE;

    if (parsedSemesters.length === 0) return base;

    parsedSemesters.sort((a, b) => a.semesterNumber - b.semesterNumber);

    const progress = this.calculateDegreeProgress({ ...base, semesters: parsedSemesters });
    return {
      ...base,
      semesters: parsedSemesters,
      completedCredits: progress.completedCredits,
      totalRequiredCredits: progress.totalRequiredCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Aplica o resultado JSON da IA (histórico) na grade existente.
   */
  static applyAIParsedTranscript(aiResult: any, existingData?: CourseProgressData): CourseProgressData {
    const base = (existingData && Array.isArray(existingData.semesters))
      ? existingData
      : DEFAULT_CURRICULUM_TEMPLATE;

    const updatedSemesters = base.semesters.map(sem => ({
      ...sem,
      subjects: [...(sem.subjects || [])]
    }));

    const approvedSubjects: any[] = Array.isArray(aiResult.approvedSubjects) ? aiResult.approvedSubjects : [];
    const baselineCR = typeof aiResult.baselineCR === 'number' ? aiResult.baselineCR : base.baselineCR;

    approvedSubjects.forEach(approvedSub => {
      if (!approvedSub.name) return;
      
      const normalizedApprovedName = approvedSub.name.toLowerCase().trim();
      const approvedWords = normalizedApprovedName.split(' ').filter((w: string) => w.length > 3);

      updatedSemesters.forEach(sem => {
        sem.subjects.forEach(sub => {
          const normalizedSubName = sub.name.toLowerCase().trim();
          const subWords = normalizedSubName.split(' ').filter(w => w.length > 3);
          
          let matchCount = 0;
          for (const w of approvedWords) {
            if (normalizedSubName.includes(w)) matchCount++;
          }
          for (const w of subWords) {
            if (normalizedApprovedName.includes(w)) matchCount++;
          }
          
          const requiredMatches = Math.min(2, Math.max(subWords.length, approvedWords.length));
          
          if (matchCount >= requiredMatches || normalizedApprovedName === normalizedSubName || (sub.code && normalizedApprovedName.includes(sub.code.toLowerCase()))) {
            sub.isCompleted = true;
            if (typeof approvedSub.grade === 'number') {
              sub.grade = approvedSub.grade;
            }
          }
        });
      });
    });

    const progress = this.calculateDegreeProgress({ ...base, semesters: updatedSemesters });
    return {
      ...base,
      baselineCR,
      semesters: updatedSemesters,
      completedCredits: progress.completedCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Aplica o resultado JSON da IA (fluxograma) como uma nova matriz.
   */
  static applyAIParsedCurriculum(aiResult: any, existingData?: CourseProgressData): CourseProgressData {
    const base = (existingData && Array.isArray(existingData.semesters))
      ? existingData
      : DEFAULT_CURRICULUM_TEMPLATE;

    const parsedSemesters = Array.isArray(aiResult.semesters) ? aiResult.semesters : [];
    if (parsedSemesters.length === 0) return base;

    const mappedSemesters: CourseSemester[] = parsedSemesters.map((sem: any, idx: number) => {
      const num = sem.semesterNumber || idx + 1;
      const subjects = Array.isArray(sem.subjects) ? sem.subjects.map((sub: any) => {
        const credits = typeof sub.credits === 'number' ? sub.credits : 4;
        return {
          id: generateId('flow'),
          name: sub.name || 'Disciplina',
          credits,
          hours: sub.hours || credits * 15,
          isCompleted: !!sub.isCompleted,
          grade: sub.grade
        } as CourseHistorySubject;
      }) : [];

      return {
        semesterNumber: num,
        title: sem.title || `${num}º Semestre`,
        subjects
      };
    });

    mappedSemesters.sort((a, b) => a.semesterNumber - b.semesterNumber);

    const progress = this.calculateDegreeProgress({ ...base, semesters: mappedSemesters });
    return {
      ...base,
      semesters: mappedSemesters,
      completedCredits: progress.completedCredits,
      totalRequiredCredits: progress.totalRequiredCredits,
      lastUpdated: new Date().toISOString()
    };
  }

  // Persistence helpers
  static async loadCourseProgress(): Promise<CourseProgressData> {
    try {
      const stored = await AsyncStorage.getItem(COURSE_PROGRESS_STORAGE_KEY);
      if (stored && typeof stored === 'string' && stored.trim().length > 0 && stored.trim() !== 'null' && stored.trim() !== 'undefined') {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.semesters) && parsed.semesters.length > 0) {
          return {
            ...DEFAULT_CURRICULUM_TEMPLATE,
            ...parsed,
            semesters: parsed.semesters.filter(Boolean).map((s: any) => ({
              ...s,
              subjects: Array.isArray(s.subjects) ? s.subjects.filter(Boolean) : []
            }))
          };
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar progresso do curso:', e);
    }
    return DEFAULT_CURRICULUM_TEMPLATE;
  }

  static async saveCourseProgress(data: CourseProgressData): Promise<void> {
    try {
      await AsyncStorage.setItem(COURSE_PROGRESS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar progresso do curso:', e);
    }
  }
}
