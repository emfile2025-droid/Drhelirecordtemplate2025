/** Metrics collection deadline regression test. Run with: node scripts/_test_metrics_deadline.js */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const serviceWorker = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const blockStart = html.indexOf('// ====== 利用メトリクス収集機能');
const blockEnd = html.indexOf('// ===================================', blockStart);
assert(blockStart >= 0 && blockEnd > blockStart, 'metrics block must exist');
const metricsCode = html.slice(blockStart, blockEnd);

const END_MS = 1788793199999;
const AFTER_MS = 1788793200000;
const PATIENT_KEY = 'heliRecordV5';
const METRICS_KEYS = [
  'metrics_queue_v2', 'metrics_installation_id_v2', 'metrics_case_id_v2',
  'metrics_case_start_sent_v2', 'metrics_case_start_ts_v2', 'metrics_active_ms_v2',
  'metrics_last_activity_ts_v2', 'metrics_first_input_case_v2',
  'metrics_completed_case_v2', 'metrics_queue_v1', 'metrics_start_ts',
  'metrics_session_id'
];

function createHarness(nowMs, seed = {}) {
  const values = new Map(Object.entries(seed));
  const documentListeners = {};
  const windowListeners = {};
  const timers = new Map();
  const fetchCalls = [];
  let timerId = 0;
  let idCounter = 0;
  const context = vm.createContext({
    console,
    Date: class extends Date {
      static now() { return nowMs; }
    },
    Math,
    Number,
    Object,
    Array,
    JSON,
    Set,
    Promise,
    crypto: { randomUUID: () => `test-id-${++idCounter}` },
    localStorage: {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: key => values.delete(key)
    },
    document: {
      title: 'deadline-test',
      addEventListener: (name, fn) => { documentListeners[name] = fn; }
    },
    window: {
      addEventListener: (name, fn) => { windowListeners[name] = fn; }
    },
    state: {
      request: {}, patient: {}, ems: { vitals: [], procedures: {}, chips: {} },
      fd: { vitals: [], procedures: {}, chips: {} }, heli: {},
      problems: [], destination: {}
    },
    currentAppMode: 'normal',
    fetch: async (...args) => { fetchCalls.push(args); return {}; },
    setTimeout: (fn, delay) => {
      const id = ++timerId;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout: id => timers.delete(id)
  });
  vm.runInContext(metricsCode, context);
  const api = vm.runInContext(`({
    isMetricsCollectionOpen, createMetricsId, initMetricsSession,
    handleMetricsInteraction, trackMetricsEvent, sendMetrics,
    trackMetricsCaseCompletion, resetMetricsCase, readMetricsQueue,
    writeMetricsQueue, scheduleMetricsFlush, flushMetricsQueue,
    clearMetricsStorageAfterClosure, metricsRuntime
  })`, context);
  return { api, values, documentListeners, windowListeners, timers, fetchCalls };
}

async function main() {
  assert(!html.includes('localStorage.clear()'), 'localStorage.clear must not be used');
  assert(serviceWorker.includes("const CACHE_PREFIX = 'heli-record-'"));
  assert(serviceWorker.includes("heli-record-v5.1.20-metrics-stop-20260908"));
  assert(serviceWorker.includes('cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME'));
  assert.strictEqual(Date.parse('2026-09-07T23:59:59.999+09:00'), END_MS);
  assert.strictEqual(Date.parse('2026-09-08T00:00:00.000+09:00'), AFTER_MS);

  const before = createHarness(END_MS, { [PATIENT_KEY]: 'patient-record' });
  assert.strictEqual(before.api.isMetricsCollectionOpen(END_MS), true);
  assert.strictEqual(before.api.isMetricsCollectionOpen(AFTER_MS), false);
  assert(before.values.has('metrics_installation_id_v2'));
  assert(before.api.metricsRuntime.appSessionId);

  before.api.metricsRuntime.sending = true;
  before.api.handleMetricsInteraction();
  before.api.trackMetricsEvent('tab_open', { tab: 'output' });
  before.api.sendMetrics('copy');
  before.api.trackMetricsEvent('referral_open');
  before.api.trackMetricsEvent('referral_copy');
  before.api.sendMetrics('mail');
  before.api.resetMetricsCase({ cancelled: true });
  before.api.initMetricsSession();
  before.api.resetMetricsCase();
  const queuedBeforeSend = before.api.readMetricsQueue();
  const eventNames = new Set(queuedBeforeSend.map(item => item.payload.event_name));
  [
    'case_start', 'first_input', 'tab_open', 'report_copy', 'case_complete',
    'referral_open', 'referral_copy', 'mail_open', 'case_cancel', 'case_reset'
  ].forEach(name => assert(eventNames.has(name), `deadline-before event missing: ${name}`));
  queuedBeforeSend.forEach(item => {
    assert.strictEqual(item.payload.schema_version, 3);
    assert.strictEqual(item.payload.app, 'heli');
    assert(item.payload.event_id && item.payload.installation_id && item.payload.app_session_id);
  });
  before.api.metricsRuntime.sending = false;
  await before.api.flushMetricsQueue();
  assert.strictEqual(before.fetchCalls.length, 1, 'deadline-before queue should send');
  assert.strictEqual(before.values.get(PATIENT_KEY), 'patient-record');

  const closedSeed = { [PATIENT_KEY]: 'patient-record', unrelated_setting: 'keep' };
  METRICS_KEYS.forEach(key => { closedSeed[key] = key === 'metrics_queue_v2' ? '[{"payload":{}}]' : 'old'; });
  const after = createHarness(AFTER_MS, closedSeed);
  assert.strictEqual(after.api.metricsRuntime.installationId, '');
  assert.strictEqual(after.api.metricsRuntime.appSessionId, '');
  assert.strictEqual(after.api.createMetricsId(), '');
  assert.strictEqual(after.api.initMetricsSession(), '');
  after.api.handleMetricsInteraction();
  after.api.trackMetricsEvent('tab_open');
  after.api.sendMetrics('copy');
  after.api.trackMetricsCaseCompletion('activity_report');
  after.api.resetMetricsCase({ cancelled: true });
  after.api.writeMetricsQueue([{ payload: { event_id: 'new' } }]);
  after.api.scheduleMetricsFlush([{ payload: { event_id: 'old' }, next_attempt_ts: 0 }]);
  await after.api.flushMetricsQueue();
  if (after.windowListeners.online) await after.windowListeners.online();
  if (after.documentListeners.input) after.documentListeners.input({ target: {} });
  if (after.documentListeners.change) after.documentListeners.change({ target: {} });
  assert.strictEqual(after.fetchCalls.length, 0, 'deadline-after must not access GAS');
  METRICS_KEYS.forEach(key => assert.strictEqual(after.values.has(key), false, `metrics key remained: ${key}`));
  assert.strictEqual(after.values.get(PATIENT_KEY), 'patient-record');
  assert.strictEqual(after.values.get('unrelated_setting'), 'keep');
  assert.strictEqual(after.api.readMetricsQueue().length, 0);

  console.log('OK: deadline boundary is timezone-independent and inclusive through .999');
  console.log('OK: pre-deadline event IDs, queue, payload shape, and sending are preserved');
  console.log('OK: post-deadline IDs, queue writes, retries, online sends, and GAS access are blocked');
  console.log('OK: only metrics storage keys are removed; heliRecordV5 and unrelated settings remain');
  console.log('OK: service worker cleanup is limited to Doctor Heli cache keys');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
