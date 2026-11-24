/**
 * Rendering layer. All user-controlled strings are written with textContent
 * through the `el` helper, never as HTML.
 */

import { verifyRecords } from './chain.js';
import { serializeArchive } from './archive.js';
import { utf8Bytes } from './fnv1a.js';
import { formatBytes, formatTime } from './format.js';
import { byId, clear, el } from './dom.js';

const kpiRecords = byId('kpi-records');
const kpiRecordsMeta = byId('kpi-records-meta');
const kpiPending = byId('kpi-pending');
const kpiPendingMeta = byId('kpi-pending-meta');
const kpiStatus = byId('kpi-status');
const kpiStatusMeta = byId('kpi-status-meta');
const kpiSize = byId('kpi-size');
const kpiSizeMeta = byId('kpi-size-meta');

const chainPill = byId('chain-pill');
const queueList = byId('queue-list');
const queueEmpty = byId('queue-empty');
const queueCount = byId('queue-count');
const recordsList = byId('records-list');
const recordsEmpty = byId('records-empty');
const recordsCount = byId('records-count');
const processNextButton = byId('process-next');
const processAllButton = byId('process-all');
const integrityResult = byId('integrity-result');

/**
 * @typedef {{
 *   query: string,
 *   verification: { ok: boolean, error: string, at: number } | null
 * }} DashboardView
 */

/**
 * @param {import('./store.js').DashboardState} state
 * @param {DashboardView} view
 */
export function render(state, view) {
  const verification = verifyRecords(state.records);
  const archiveBytes = utf8Bytes(
    serializeArchive(state.records, state.pending),
  ).length;

  renderKpis(state, verification, archiveBytes);
  renderChainPill(verification);
  renderQueue(state);
  renderRecords(state, view.query);
  renderIntegrity(view.verification);
}

/**
 * @param {import('./store.js').DashboardState} state
 * @param {{ ok: boolean, error: string }} verification
 * @param {number} archiveBytes
 */
function renderKpis(state, verification, archiveBytes) {
  kpiRecords.textContent = String(state.records.length);
  kpiRecordsMeta.textContent = state.records.length
    ? `Newest #${state.records[state.records.length - 1].id}`
    : 'No records yet';

  kpiPending.textContent = String(state.pending.length);
  kpiPendingMeta.textContent = state.pending.length
    ? `Oldest #${state.pending[0].id}`
    : 'Queue is clear';

  kpiStatus.textContent = verification.ok ? 'Verified' : 'Failed';
  kpiStatus.dataset.state = verification.ok ? 'ok' : 'error';
  kpiStatusMeta.textContent = verification.ok
    ? `${state.records.length} digest${state.records.length === 1 ? '' : 's'} checked`
    : verification.error;

  kpiSize.textContent = formatBytes(archiveBytes);
  kpiSizeMeta.textContent = 'MEDKEEP v2 archive';
}

/**
 * @param {{ ok: boolean, error: string }} verification
 */
function renderChainPill(verification) {
  chainPill.dataset.state = verification.ok ? 'ok' : 'error';
  chainPill.textContent = verification.ok ? 'Chain verified' : 'Chain failed';
}

/**
 * @param {import('./store.js').DashboardState} state
 */
function renderQueue(state) {
  clear(queueList);
  queueCount.textContent = String(state.pending.length);
  processNextButton.disabled = state.pending.length === 0;
  processAllButton.disabled = state.pending.length === 0;

  queueEmpty.hidden = state.pending.length > 0;
  if (state.pending.length === 0) {
    return;
  }

  state.pending.forEach((request, index) => {
    queueList.append(
      el(
        'li',
        { class: 'queue-item' },
        el(
          'div',
          { class: 'queue-item__top' },
          el('span', { class: 'badge', text: `#${request.id}` }),
          index === 0 ? el('span', { class: 'tag tag--next', text: 'Next' }) : null,
        ),
        el('p', {
          class: 'queue-item__content',
          text: request.content.trim().length ? request.content : '(empty record)',
        }),
      ),
    );
  });
}

/**
 * @param {import('./store.js').DashboardState} state
 * @param {string} query
 */
export function renderRecords(state, query = '') {
  const normalized = query.trim().toLowerCase();
  const newestFirst = [...state.records].reverse();
  const filtered = normalized
    ? newestFirst.filter((record) => matches(record, normalized))
    : newestFirst;

  clear(recordsList);
  recordsCount.textContent = normalized
    ? `${filtered.length} of ${state.records.length}`
    : String(state.records.length);

  recordsEmpty.hidden = filtered.length > 0;
  if (filtered.length === 0) {
    recordsEmpty.textContent = state.records.length === 0
      ? 'No committed records yet. Add a request and process the queue to start the chain.'
      : 'No records match your search.';
    return;
  }

  for (const record of filtered) {
    recordsList.append(renderRecord(record));
  }
}

/**
 * @param {{ id: number, content: string, digest: string }} record
 */
function renderRecord(record) {
  return el(
    'li',
    { class: 'record' },
    el(
      'div',
      { class: 'record__top' },
      el('span', { class: 'badge', text: `#${record.id}` }),
      el('code', {
        class: 'digest',
        title: 'FNV-1a 64-bit chained digest',
        text: record.digest,
      }),
      el('button', {
        class: 'button button--tiny',
        type: 'button',
        'data-copy-digest': record.digest,
        'aria-label': `Copy digest for record ${record.id}`,
        text: 'Copy',
      }),
    ),
    el('p', {
      class: 'record__content',
      text: record.content.trim().length ? record.content : '(empty record)',
    }),
  );
}

/**
 * @param {{ id: number, content: string, digest: string }} record
 * @param {string} query
 */
function matches(record, query) {
  return (
    String(record.id) === query
    || String(record.id).includes(query)
    || record.digest.includes(query)
    || record.content.toLowerCase().includes(query)
  );
}

/**
 * @param {DashboardView['verification']} verification
 */
export function renderIntegrity(verification) {
  clear(integrityResult);

  if (!verification) {
    integrityResult.dataset.state = 'idle';
    integrityResult.append(
      el('p', {
        class: 'integrity__message',
        text: 'Not checked in this session. Run verification to recompute every digest from genesis to tip.',
      }),
    );
    return;
  }

  integrityResult.dataset.state = verification.ok ? 'ok' : 'error';
  integrityResult.append(
    el(
      'p',
      { class: 'integrity__message' },
      el('strong', {
        text: verification.ok ? 'Chain verified. ' : 'Chain verification failed. ',
      }),
      el('span', {
        text: verification.ok
          ? `All digests match as of ${formatTime(verification.at)}.`
          : verification.error,
      }),
    ),
  );
}
