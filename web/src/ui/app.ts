import {
  addRequest,
  exportArchive,
  getState,
  loadSeed,
  processAll,
  processNext,
  replaceArchive,
  resetAll,
  subscribe,
  verify,
} from '../data/store';
import { parseArchive } from '../domain/archive';
import { verifyRecords } from '../domain/chain';
import { utf8Bytes } from '../domain/fnv1a';
import { serializeArchive } from '../domain/archive';
import type { DashboardState, Verification } from '../domain/types';
import { downloadFile } from '../lib/download';
import { formatBytes } from '../lib/format';
import { COPY } from './copy';
import { createComposer } from './components/composer';
import { createConfirmDialog, createImportDialog } from './components/dialogs';
import { createIntegrityPanel, type IntegrityView } from './components/integrity-panel';
import { createKpiCard } from './components/kpi-card';
import { createQueuePanel } from './components/queue';
import { createRecordsPanel } from './components/records';
import { createStatusPill } from './components/status-pill';
import { createTopBar } from './components/top-bar';
import { el } from './dom';
import { initTheme, toggleTheme, type Theme } from './theme';
import { createToastRegion, type ToastTone } from './toast';

export interface AppOptions {
  readonly initialError: string;
  readonly persisted: boolean;
}

export interface App {
  readonly node: HTMLElement;
}

export function createApp(options: AppOptions): App {
  let theme: Theme = initTheme();
  let query = readInitialQuery();
  let verificationView: IntegrityView | null = null;

  const toastRegion = createToastRegion();
  const toast = (message: string, tone: ToastTone = 'info'): void => {
    toastRegion.show(message, tone);
  };

  const statusPill = createStatusPill();
  const kpiRecords = createKpiCard('Committed records', 'No records yet');
  const kpiPending = createKpiCard('Pending requests', 'Queue is clear');
  const kpiIntegrity = createKpiCard('Integrity', 'Not checked');
  const kpiSize = createKpiCard('Archive size', 'MEDKEEP v2');

  function onAdd(content: string): void {
    const request = addRequest(content);
    toast(`Request #${request.id} added to the queue.`, 'success');
  }

  function onProcessNext(): void {
    try {
      const record = processNext();
      if (record === null) {
        toast('The queue is empty.', 'info');
        return;
      }
      toast(`Record #${record.id} committed to the chain.`, 'success');
    } catch (thrown) {
      toast(errorMessage(thrown), 'error');
    }
  }

  function onProcessAll(): void {
    const pending = getState().pending.length;
    if (pending === 0) {
      toast('The queue is empty.', 'info');
      return;
    }

    if (pending > 5) {
      confirmDialog.open(
        {
          title: 'Commit every pending request?',
          body: `${pending} requests will be committed to the chain in FIFO order.`,
          confirmLabel: 'Process all',
          onConfirm: processEverything,
        },
        null,
      );
      return;
    }

    processEverything();
  }

  function processEverything(): void {
    try {
      const count = processAll();
      toast(`Committed ${count} request${count === 1 ? '' : 's'} to the chain.`, 'success');
    } catch (thrown) {
      toast(errorMessage(thrown), 'error');
    }
  }

  function onVerify(): void {
    try {
      verificationView = { result: verify(), at: Date.now() };
      render();
      if (verificationView.result.ok) {
        toast('Chain verified.', 'success');
      } else {
        toast(verificationView.result.error, 'error');
      }
    } catch (thrown) {
      toast(errorMessage(thrown), 'error');
    }
  }

  function onExport(): void {
    try {
      const archive = exportArchive();
      downloadFile(archive.filename, archive.contents);
      toast('Archive exported.', 'success');
    } catch (thrown) {
      toast(errorMessage(thrown), 'error');
    }
  }

  function onImport(text: string): void {
    const parsed = parseArchive(text);
    replaceArchive(parsed);
    verificationView = null;
    const recordLabel = parsed.records.length === 1 ? 'record' : 'records';
    toast(
      `Imported ${String(parsed.records.length)} ${recordLabel} and ${String(parsed.pending.length)} pending.`,
      'success',
    );
  }

  function onLoadDemo(): void {
    const state = getState();
    const apply = (): void => {
      try {
        loadSeed();
        verificationView = null;
        toast('Demo data loaded.', 'success');
      } catch (thrown) {
        toast(errorMessage(thrown), 'error');
      }
    };

    const hasData = state.records.length > 0 || state.pending.length > 0;
    confirmDialog.open(
      {
        title: hasData ? 'Replace the current ledger with demo data?' : 'Load demo data?',
        body: hasData
          ? 'Your current records and queue will be replaced. Export first if you need a copy.'
          : 'Load fictional records and requests into this browser.',
        confirmLabel: 'Load demo data',
        tone: hasData ? 'danger' : 'primary',
        onConfirm: apply,
      },
      null,
    );
  }

  function onClear(): void {
    confirmDialog.open(
      {
        title: 'Clear all local data?',
        body: 'Every record and pending request in this browser will be removed. Export first if you need a copy.',
        confirmLabel: 'Clear all data',
        tone: 'danger',
        onConfirm: () => {
          try {
            resetAll();
            verificationView = null;
            toast('All local data cleared.', 'success');
          } catch (thrown) {
            toast(errorMessage(thrown), 'error');
          }
        },
      },
      null,
    );
  }

  function onCopy(digest: string): void {
    void copyText(digest)
      .then(() => {
        toast('Digest copied to the clipboard.', 'success');
      })
      .catch(() => {
        toast('Could not copy the digest.', 'error');
      });
  }

  function onSearch(value: string): void {
    query = value;
    writeQuery(value);
    recordsPanel.update(getState().records, query);
  }

  function onToggleTheme(): void {
    theme = toggleTheme();
    topBar.setTheme(theme);
  }

  const importDialog = createImportDialog({ onImport });
  const confirmDialog = createConfirmDialog();
  const topBar = createTopBar({
    onToggleTheme,
    onImport: () => {
      importDialog.open(null);
    },
    onExport,
  });
  const composer = createComposer({ onAdd });
  const recordsPanel = createRecordsPanel({ onSearch, onCopy });

  const queuePanel = createQueuePanel({ onProcessNext, onProcessAll });
  const integrityPanel = createIntegrityPanel({ onVerify });

  const hero = el(
    'section',
    { class: 'hero' },
    el(
      'div',
      { class: 'hero__status' },
      statusPill.node,
      el('span', { class: 'hero__caption', text: 'Live verification' }),
    ),
    el('h1', { class: 'hero__title', text: COPY.heroTitle }),
    el('p', { class: 'hero__body', text: COPY.heroBody }),
  );

  const kpiGrid = el(
    'div',
    { class: 'kpi-grid', role: 'group', 'aria-label': 'Ledger summary' },
    kpiRecords.node,
    kpiPending.node,
    kpiIntegrity.node,
    kpiSize.node,
  );

  const composerPanel = el(
    'section',
    { class: 'panel composer', 'aria-labelledby': 'composer-title' },
    el(
      'div',
      { class: 'panel__header' },
      el(
        'div',
        { class: 'panel__heading' },
        el('h2', { id: 'composer-title', class: 'panel__title', text: 'New request' }),
      ),
    ),
    composer.node,
  );

  const workGrid = el(
    'div',
    { class: 'work-grid' },
    el('div', { class: 'work-grid__primary' }, composerPanel, queuePanel.node),
    integrityPanel.node,
  );

  const footer = el(
    'footer',
    { class: 'footer' },
    el('p', { class: 'footer__privacy', text: COPY.privacy }),
    el(
      'div',
      { class: 'footer__actions' },
      el(
        'button',
        { class: 'button button--ghost', type: 'button', onclick: onLoadDemo },
        COPY.demoAction,
      ),
      el(
        'button',
        { class: 'button button--ghost', type: 'button', onclick: onClear },
        COPY.clearAction,
      ),
    ),
  );

  const warning = options.persisted
    ? null
    : el(
        'div',
        { class: 'banner banner--warning', role: 'status' },
        el('p', {
          class: 'banner__text',
          text: options.initialError
            ? `${COPY.storageUnavailable} ${options.initialError}`
            : COPY.storageUnavailable,
        }),
      );

  const page = el(
    'main',
    { id: 'main-content', class: 'page', tabindex: '-1' },
    hero,
    kpiGrid,
    workGrid,
    recordsPanel.node,
    footer,
  );

  const node = el(
    'div',
    { class: 'app-shell' },
    topBar.node,
    warning,
    page,
    importDialog.node,
    confirmDialog.node,
    toastRegion.node,
  );

  let cachedState: DashboardState | null = null;
  let cachedVerification: Verification = { ok: true, records: [] };

  function liveVerification(state: DashboardState): Verification {
    if (cachedState !== state) {
      cachedState = state;
      cachedVerification = verifyRecords(state.records);
    }
    return cachedVerification;
  }

  function render(): void {
    const state = getState();
    const live = liveVerification(state);

    statusPill.update(live);
    topBar.setTheme(theme);

    const newest = state.records[state.records.length - 1];
    kpiRecords.update(
      String(state.records.length),
      newest ? `Newest #${String(newest.id)}` : 'No records yet',
    );

    const oldest = state.pending[0];
    kpiPending.update(
      String(state.pending.length),
      oldest ? `Oldest #${String(oldest.id)}` : 'Queue is clear',
    );

    kpiIntegrity.update(
      live.ok ? 'Verified' : 'Failed',
      live.ok
        ? `${String(state.records.length)} digest${state.records.length === 1 ? '' : 's'} checked`
        : live.error,
      live.ok ? 'ok' : 'error',
    );

    const archiveBytes = utf8Bytes(serializeArchive(state.records, state.pending)).length;
    kpiSize.update(formatBytes(archiveBytes), 'MEDKEEP v2 archive');

    queuePanel.update(state);
    recordsPanel.update(state.records, query);
    integrityPanel.update(verificationView);
  }

  subscribe((state) => {
    if (cachedState !== null && cachedState.records !== state.records) {
      verificationView = null;
    }
    render();
  });
  render();

  if (options.initialError.length > 0) {
    toast(options.initialError, 'error');
  }

  return { node };
}

function readInitialQuery(): string {
  try {
    return new URLSearchParams(globalThis.location.search).get('q') ?? '';
  } catch {
    return '';
  }
}

function writeQuery(value: string): void {
  try {
    const url = new URL(globalThis.location.href);
    if (value.trim().length > 0) {
      url.searchParams.set('q', value);
    } else {
      url.searchParams.delete('q');
    }
    globalThis.history.replaceState(null, '', url);
  } catch {
    /* history may be unavailable; the search still works in memory */
  }
}

async function copyText(text: string): Promise<void> {
  const clipboard = globalThis.navigator.clipboard as Clipboard | undefined;
  if (clipboard === undefined || typeof clipboard.writeText !== 'function') {
    throw new Error('Clipboard is unavailable.');
  }
  await clipboard.writeText(text);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Something went wrong.';
}
