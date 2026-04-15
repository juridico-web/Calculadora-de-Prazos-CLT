/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Calendar, Copy, Trash2, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- HOLIDAY DATA & LOGIC ---

interface Holiday {
  name: string;
  type: 'National' | 'State' | 'Municipal' | 'Mobile';
}

const FIXED_HOLIDAYS: Record<string, Holiday> = {
  '01-01': { name: 'Confraternização Universal', type: 'National' },
  '03-09': { name: 'Aniversário de Joinville', type: 'Municipal' },
  '04-21': { name: 'Tiradentes', type: 'National' },
  '05-01': { name: 'Dia do Trabalho', type: 'National' },
  '08-11': { name: 'Dia do Estado de SC (Data Magna)', type: 'State' },
  '09-07': { name: 'Independência do Brasil', type: 'National' },
  '10-12': { name: 'Nsa. Sra. Aparecida', type: 'National' },
  '11-02': { name: 'Finados', type: 'National' },
  '11-15': { name: 'Proclamação da República', type: 'National' },
  '11-20': { name: 'Dia da Consciência Negra', type: 'National' },
  '12-03': { name: 'São Francisco Xavier (Padroeiro Joinville)', type: 'Municipal' },
  '12-25': { name: 'Natal', type: 'National' },
};

function getMobileHolidays(year: number): Record<string, Holiday> {
  const f: Record<string, Holiday> = {};
  
  // Algorithm to calculate Easter
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f_val = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f_val + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  
  const easter = new Date(year, mes - 1, dia);
  
  const addMobile = (base: Date, offset: number, name: string) => {
    const d = new Date(base);
    d.setDate(d.getDate() + offset);
    const key = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    f[key] = { name, type: 'Mobile' };
  };

  addMobile(easter, -2, 'Sexta-feira Santa');
  addMobile(easter, 60, 'Corpus Christi');
  addMobile(easter, -48, 'Segunda-feira de Carnaval');
  addMobile(easter, -47, 'Terça-feira de Carnaval');

  return f;
}

function isBusinessDay(date: Date): { isBusiness: boolean; reason?: string } {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  if (dayOfWeek === 0) return { isBusiness: false, reason: 'Domingo' };
  if (dayOfWeek === 6) return { isBusiness: false, reason: 'Sábado' };

  const mmdd = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const fixed = FIXED_HOLIDAYS[mmdd];
  if (fixed) return { isBusiness: false, reason: `Feriado: ${fixed.name}` };

  const mobile = getMobileHolidays(date.getFullYear())[mmdd];
  if (mobile) return { isBusiness: false, reason: `Feriado: ${mobile.name}` };

  return { isBusiness: true };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// --- COMPONENTS ---

export default function App() {
  const [tipoMarco, setTipoMarco] = useState('Publicação');
  const [dataInicial, setDataInicial] = useState('');
  const [prazoDias, setPrazoDias] = useState<number | ''>('');
  const [obs, setObs] = useState('');
  const [result, setResult] = useState<{
    marcoInicial: string;
    dataFinal: string;
    dataFinalSemana: string;
    memoria: { text: string; isVencimento?: boolean; isNotUtil?: boolean; dayNum?: string }[];
    alertas: string[];
  } | null>(null);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dataInicial || !prazoDias) return;

    const [year, month, day] = dataInicial.split('-').map(Number);
    let current = new Date(year, month - 1, day);
    const startMilestone = new Date(current);
    
    const memoria: { text: string; isVencimento?: boolean; isNotUtil?: boolean; dayNum?: string }[] = [];
    const alertas: string[] = [
      'Contagem em dias úteis conforme Art. 775 da CLT.',
      'Sujeita à confirmação de eventuais suspensões de expediente publicadas pelo TRT-12.',
      'Verifique feriados municipais em caso de outras comarcas.'
    ];

    if (obs.trim()) {
      alertas.push(`Observação: ${obs}`);
    }

    memoria.push({ 
      text: `Marco: ${formatDate(startMilestone)} - Excluído`, 
      dayNum: '--' 
    });

    // CLT Rule: Exclude start day
    current.setDate(current.getDate() + 1);

    // Rule: Start on the first business day after the milestone
    while (!isBusinessDay(current).isBusiness) {
      const { reason } = isBusinessDay(current);
      memoria.push({ 
        text: `${formatDate(current)} (${getWeekDay(current)}) - Não útil: ${reason}`, 
        isNotUtil: true,
        dayNum: '--'
      });
      current.setDate(current.getDate() + 1);
    }

    let businessDaysCounted = 0;
    while (businessDaysCounted < (prazoDias as number)) {
      const check = isBusinessDay(current);
      if (check.isBusiness) {
        businessDaysCounted++;
        const isVenc = businessDaysCounted === (prazoDias as number);
        memoria.push({ 
          text: `${formatDate(current)} (${getWeekDay(current)})${isVenc ? ' - VENCIMENTO' : ''}`, 
          isVencimento: isVenc,
          dayNum: `${String(businessDaysCounted).padStart(2, '0')}º`
        });
      } else {
        memoria.push({ 
          text: `${formatDate(current)} (${getWeekDay(current)}) - Não útil: ${check.reason}`, 
          isNotUtil: true,
          dayNum: '--'
        });
      }

      if (businessDaysCounted < (prazoDias as number)) {
        current.setDate(current.getDate() + 1);
      }
    }

    // Ensure the final day is a business day
    while (!isBusinessDay(current).isBusiness) {
      const { reason } = isBusinessDay(current);
      memoria.push({ 
        text: `${formatDate(current)} (${getWeekDay(current)}) - Prorrogação: ${reason}`, 
        isNotUtil: true,
        dayNum: '--'
      });
      current.setDate(current.getDate() + 1);
    }

    setResult({
      marcoInicial: `${tipoMarco} em ${formatDate(startMilestone)}`,
      dataFinal: formatDate(current),
      dataFinalSemana: getWeekDay(current),
      memoria,
      alertas
    });
  };

  const handleClear = () => {
    setTipoMarco('Publicação');
    setDataInicial('');
    setPrazoDias('');
    setObs('');
    setResult(null);
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `
Marco inicial adotado:
${result.marcoInicial}

Data final do prazo:
${result.dataFinal} (${result.dataFinalSemana})

Memória de cálculo:
${result.memoria.map(m => `${m.dayNum} ${m.text}`).join('\n')}

Alertas de dúvida ou risco:
${result.alertas.join('\n')}
    `.trim();
    navigator.clipboard.writeText(text);
    alert('Resultado copiado!');
  };

  function getWeekDay(date: Date) {
    return ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'][date.getDay()];
  }

  return (
    <div className="min-h-screen bg-bg text-ink font-sans p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-end border-b-2 border-line pb-3 mb-5">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold uppercase tracking-tight leading-none">
              Calculadora de Prazos CLT
            </h1>
            <p className="font-mono text-[12px] opacity-70 uppercase tracking-wider">
              JOINVILLE / SC • SISTEMA DE CONTAGEM EM DIAS ÚTEIS (ART. 775)
            </p>
          </div>
          <div className="text-[10px] font-bold text-right leading-tight opacity-60">
            V 2.5.0<br />
            BASE LEGAL: REFORMA TRABALHISTA
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] lg:grid-rows-[200px_1fr] gap-4 h-full">
          {/* INPUT SECTION */}
          <section className="bento-card lg:row-span-2">
            <span className="card-title">Parâmetros do Cálculo</span>
            <form onSubmit={handleCalculate} className="flex flex-col h-full space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="bento-label">Marco Inicial</label>
                  <select
                    value={tipoMarco}
                    onChange={(e) => setTipoMarco(e.target.value)}
                    className="bento-input"
                  >
                    <option value="Publicação">Publicação em Diário</option>
                    <option value="Juntada do AR">Juntada de AR</option>
                    <option value="Ciência em Audiência">Ciência em Audiência</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="bento-label">Data de Início</label>
                  <input
                    type="date"
                    required
                    value={dataInicial}
                    onChange={(e) => setDataInicial(e.target.value)}
                    className="bento-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="bento-label">Prazo (Dias Úteis)</label>
                  <input
                    type="number"
                    required
                    min="1"
                    placeholder="Ex: 8"
                    value={prazoDias}
                    onChange={(e) => setPrazoDias(e.target.value === '' ? '' : parseInt(e.target.value))}
                    className="bento-input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="bento-label">Comarca</label>
                  <input
                    type="text"
                    readOnly
                    value="Joinville / SC"
                    className="bento-input opacity-60 cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1 flex-grow">
                  <label className="bento-label">Observações Adicionais</label>
                  <textarea
                    rows={4}
                    placeholder="Suspensões específicas, portarias locais..."
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    className="bento-input resize-none h-24"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-auto pt-4">
                <button type="button" onClick={handleClear} className="bento-btn">
                  Limpar
                </button>
                <button type="submit" className="bento-btn bento-btn-primary">
                  Calcular
                </button>
              </div>
            </form>
          </section>

          {/* MAIN RESULT */}
          <section className={`bento-card justify-center items-center text-center transition-colors duration-500 ${result ? 'bg-ink text-white' : 'bg-white opacity-40'}`}>
            <span className={`card-title border-none mb-0 ${result ? 'text-gray-400' : ''}`}>Data Final do Prazo</span>
            <div className="font-mono text-5xl font-bold my-2 tracking-tighter">
              {result ? result.dataFinal : '--/--/--'}
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] font-bold opacity-70">
              {result ? result.dataFinalSemana : 'Aguardando Cálculo'}
            </div>
          </section>

          {/* ALERTS */}
          <section className="bento-card">
            <span className="card-title">Alertas e Riscos</span>
            <div className="flex-grow">
              <div className={`p-3 text-[12px] leading-relaxed border-l-4 ${result ? 'bg-[#FFF8E1] border-[#F39C12] text-[#856404]' : 'bg-gray-50 border-gray-200 text-gray-400'}`}>
                {result ? (
                  <ul className="space-y-1 list-disc pl-4">
                    {result.alertas.map((alerta, idx) => (
                      <li key={idx}>{alerta}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="italic">Nenhum alerta gerado.</p>
                )}
              </div>
            </div>
            <button 
              onClick={handleCopy}
              disabled={!result}
              className="mt-4 bento-btn border-dashed disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Copy className="w-3 h-3" />
              Copiar Memória
            </button>
          </section>

          {/* MEMORY */}
          <section className="bento-card lg:col-span-2">
            <span className="card-title flex items-center gap-2">
              Memória de Cálculo 
              <span className="bg-gray-100 text-[9px] px-2 py-0.5 rounded-full font-sans font-bold opacity-100 tracking-normal normal-case">
                CONTAGEM DETERMINÍSTICA
              </span>
            </span>
            <div className="memory-container overflow-y-auto font-mono text-[12px] max-h-[400px] pr-2">
              {!result ? (
                <p className="p-10 text-center opacity-30 italic">Aguardando novo cálculo...</p>
              ) : (
                result.memoria.map((m, idx) => (
                  <div 
                    key={idx} 
                    className={`grid grid-cols-[80px_1fr] py-1.5 border-b border-gray-100 hover:bg-gray-50 transition-colors ${m.isVencimento ? 'bg-[#FFF3CD] font-bold' : ''} ${m.isNotUtil ? 'opacity-50' : ''}`}
                  >
                    <span className="opacity-50">{m.dayNum}</span>
                    <span>{m.text}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>

        <footer className="mt-8 text-center">
          <p className="text-[10px] uppercase tracking-[0.3em] opacity-30">
            Ferramenta Técnica • Joinville/SC • 2026
          </p>
        </footer>
      </div>
    </div>
  );
}
