import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_PULSESHOP_DIR = path.resolve(__dirname, '../../../../pulseshop');

export const CONFIG = {
  PORT: parseInt(process.env.PORT || process.env.SRE_AGENT_PORT || '5050', 10),
  PROMETHEUS_URL: process.env.PROMETHEUS_URL || 'http://localhost:9090',
  GRAFANA_URL: process.env.GRAFANA_URL || 'http://localhost:3000',

  // Primary LLM: Gemini 3.5 Flash-Lite (high free-tier RPM, low latency)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',

  // Secondary Backup LLM: Groq (OpenAI-compatible fast inference when Gemini is unavailable/rate-limited)
  GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  GROQ_MODEL: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
  GROQ_BASE_URL: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',

  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || '9000', 10),

  // Push-First Ephemeral Mode (default: customers push on break; 'hybrid' also polls)
  MONITORING_MODE: (process.env.MONITORING_MODE || 'push-ephemeral') as 'push-ephemeral' | 'hybrid' | 'pull',
  EPHEMERAL_WINDOW_HOURS: parseInt(process.env.EPHEMERAL_WINDOW_HOURS || '6', 10),
  EPHEMERAL_TTL_MS: parseInt(process.env.EPHEMERAL_TTL_MS || String(30 * 60 * 1000), 10),
  SQLITE_DB_PATH: process.env.SQLITE_DB_PATH || path.resolve(__dirname, '../../data/patchup.sqlite'),

  // Multi-Tenant GitHub App (zero user PATs) + optional local dev GITHUB_TOKEN fallback
  GITHUB_APP_ID: process.env.GITHUB_APP_ID || '',
  GITHUB_APP_SLUG: process.env.GITHUB_APP_SLUG || 'patch-up',
  GITHUB_APP_PRIVATE_KEY: (process.env.GITHUB_APP_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  GITHUB_TOKEN: process.env.GITHUB_TOKEN || '',
  GITHUB_OWNER: process.env.GITHUB_OWNER || 'Soham-1304',
  GITHUB_REPO: process.env.GITHUB_REPO || 'pulseshop',
  PULSESHOP_REPO_DIR: process.env.PULSESHOP_REPO_DIR || DEFAULT_PULSESHOP_DIR,
  DASHBOARD_PUBLIC_URL: process.env.DASHBOARD_PUBLIC_URL || 'http://localhost:5174',
  BACKEND_PUBLIC_URL: process.env.BACKEND_PUBLIC_URL || 'http://localhost:5050',

  // Explicit Demo / Simulation mode setting
  DEMO_MODE: process.env.DEMO_MODE === 'true',

  // Monitoring Timeouts & Consecutive Tick Debounce
  SCRAPE_TIMEOUT_MS: parseInt(process.env.SCRAPE_TIMEOUT_MS || '4000', 10),
  HEALTH_CHECK_TIMEOUT_MS: parseInt(process.env.HEALTH_CHECK_TIMEOUT_MS || '4000', 10),
  ALARM_CONSECUTIVE_TICKS: parseInt(process.env.ALARM_CONSECUTIVE_TICKS || '2', 10),

  // Live PulseShop Microservices (deployed independently on Vercel; override via env for local Docker)
  MONITORED_SERVICES: process.env.MONITORED_SERVICES || '',
  DEFAULT_SERVICE_URLS: {
    gateway:
      process.env.GATEWAY_URL ||
      'https://pulseshop-gateway-41zp9bnd4-2024sohamk-isuacins-projects.vercel.app',
    orders:
      process.env.ORDERS_URL ||
      'https://pulseshop-orders-7zi3gxoeo-2024sohamk-isuacins-projects.vercel.app',
    payments:
      process.env.PAYMENTS_URL ||
      'https://pulseshop-payments-7e3kr3j5d-2024sohamk-isuacins-projects.vercel.app',
  },

  // Webhooks & Pluggable Alerting Channels (Slack, Discord, ntfy loud mobile siren, PagerDuty phone/SMS)
  WEBHOOKS: {
    GITHUB_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
    SLACK_URL: process.env.SLACK_WEBHOOK_URL || '',
    DISCORD_URL: process.env.DISCORD_WEBHOOK_URL || '',
    NTFY_TOPIC_URL: process.env.NTFY_TOPIC_URL || '',
    PAGERDUTY_ROUTING_KEY: process.env.PAGERDUTY_ROUTING_KEY || '',
  },

  // Deterministic Watcher Thresholds (Zero LLM in Monitoring Loop)
  THRESHOLDS: {
    ERROR_RATE_MAX: 0.05, // > 5% 5xx
    LATENCY_P95_MAX_MS: 400, // > 400ms (2x baseline)
    LATENCY_SPIKE_RATIO: 2.0,
    THROUGHPUT_DROP_RATIO: 0.5, // > 50% drop in orders/min
    BUSINESS_THROUGHPUT_MIN_RPM: 50,
    MEMORY_LEAK_SLOPE_PER_MIN: 4,
  },

  // The Hands: Restricted Docker & Remediation Controls
  ENABLE_DOCKER_REMEDIATION: process.env.ENABLE_DOCKER_REMEDIATION !== 'false',
  ENABLE_AUTO_TEST_GATE: process.env.ENABLE_AUTO_TEST_GATE !== 'false',
  DOCKER_ALLOWED_CONTAINERS: (
    process.env.DOCKER_ALLOWED_CONTAINERS ||
    'pulseshop-gateway,pulseshop-orders,pulseshop-payments,fake-shop-orders-1,fake-shop-gateway-1,fake-shop-payments-1,disposable-test-container'
  )
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  SERVICE_CONTAINER_MAP: {
    'gateway-service': process.env.GATEWAY_CONTAINER || 'pulseshop-gateway',
    'orders-service': process.env.ORDERS_CONTAINER || 'pulseshop-orders',
    'payments-service': process.env.PAYMENTS_CONTAINER || 'pulseshop-payments',
    gateway: process.env.GATEWAY_CONTAINER || 'pulseshop-gateway',
    orders: process.env.ORDERS_CONTAINER || 'pulseshop-orders',
    payments: process.env.PAYMENTS_CONTAINER || 'pulseshop-payments',
    'pulseshop-gateway': 'pulseshop-gateway',
    'pulseshop-orders': 'pulseshop-orders',
    'pulseshop-payments': 'pulseshop-payments',
    'test-service': 'disposable-test-container',
  } as Record<string, string>,
  OPERATOR_APPROVAL_TOKEN: process.env.OPERATOR_APPROVAL_TOKEN || 'patchup-operator-2026',
  DOCKER_EXEC_TIMEOUT_MS: parseInt(process.env.DOCKER_EXEC_TIMEOUT_MS || '15000', 10),

  // Circuit Breaker & Retry Controls
  ENABLE_CIRCUIT_BREAKER: process.env.ENABLE_CIRCUIT_BREAKER !== 'false',
  ENABLE_RETRY_CONTROLS: process.env.ENABLE_RETRY_CONTROLS !== 'false',
  CIRCUIT_BREAKER_ENDPOINTS: {
    'gateway-service': process.env.GATEWAY_CIRCUIT_BREAKER_URL || '',
    'orders-service': process.env.ORDERS_CIRCUIT_BREAKER_URL || '',
    'payments-service': process.env.PAYMENTS_CIRCUIT_BREAKER_URL || '',
  } as Record<string, string>,
  RETRY_CONTROL_ENDPOINTS: {
    'gateway-service': process.env.GATEWAY_RETRY_URL || '',
    'orders-service': process.env.ORDERS_RETRY_URL || '',
    'payments-service': process.env.PAYMENTS_RETRY_URL || '',
  } as Record<string, string>,

  // Baselines & SLA (18m manual diagnosis baseline per AIA-02 handoff)
  MANUAL_DIAGNOSIS_BASELINE_SEC: 1080,
  VERIFICATION_WINDOW_SEC: parseInt(process.env.VERIFICATION_WINDOW_SEC || '30', 10),
  POLL_INTERVAL_MS: parseInt(process.env.POLL_INTERVAL_MS || '10000', 10),
};
