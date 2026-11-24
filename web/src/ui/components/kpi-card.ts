import { el } from '../dom';

export type KpiTone = 'neutral' | 'ok' | 'error';

export interface KpiCard {
  readonly node: HTMLElement;
  update(value: string, meta: string, tone?: KpiTone): void;
}

export function createKpiCard(label: string, hint: string): KpiCard {
  const value = el('span', { class: 'kpi__value', text: '—' });
  const meta = el('span', { class: 'kpi__meta', text: hint });
  const node = el(
    'div',
    { class: 'kpi', dataset: { tone: 'neutral' } },
    el('span', { class: 'kpi__label', text: label }),
    value,
    meta,
  );

  return {
    node,
    update(nextValue, nextMeta, tone = 'neutral') {
      value.textContent = nextValue;
      meta.textContent = nextMeta;
      node.dataset.tone = tone;
    },
  };
}
