import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, FolderOpen, KeyRound, RefreshCw, Save, Server, Sparkles } from 'lucide-react';
import { getBackendConfig, putBackendConfig } from '../api/client';
import {
  getApiBase,
  isMockMode,
  setMockModeOverride,
} from '../services/dropzoneApi';
import { validateLocalApiBase } from '../utils/apiErrors';

const STORAGE_WORKSPACE = 'aidropzone.workspace';
const STORAGE_LLM_KEY = 'aidropzone.llm_api_key';
const STORAGE_NAMING_STYLE = 'aidropzone.naming_style_prompt';

/** 与 PUT /config 及 backend config.json 中 DeepSeek 段对齐 */
const DEEPSEEK_LLM = {
  provider: 'deepseek',
  model: 'deepseek-chat',
  baseUrl: 'https://api.deepseek.com/v1',
} as const;

function hasAnyLlmKey(deepseekKey: string, keyHint: string): boolean {
  return Boolean(
    deepseekKey.trim() ||
      keyHint ||
      localStorage.getItem(STORAGE_LLM_KEY)?.trim(),
  );
}

function resolveLlmApiKeyForSave(deepseekKey: string): string | undefined {
  const typed = deepseekKey.trim();
  if (typed) return typed;
  const cached = localStorage.getItem(STORAGE_LLM_KEY)?.trim();
  return cached || undefined;
}

function isMissingConfigEndpointError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.trim();
  return (
    msg === '{"detail":"Not Found"}' ||
    msg === 'HTTP 404' ||
    msg.startsWith('HTTP 404')
  );
}

interface Props {
  onBack: () => void;
}

export function SettingsView({ onBack }: Props) {
  const [workspace, setWorkspace] = useState(
    () => localStorage.getItem(STORAGE_WORKSPACE) ?? '',
  );
  const [apiBase, setApiBase] = useState(
    () => localStorage.getItem('aidropzone.api_base') ?? getApiBase(),
  );
  const [useMock, setUseMock] = useState(() => isMockMode());
  const [aiParser, setAiParser] = useState<'mock' | 'llm'>('mock');
  const [deepseekKey, setDeepseekKey] = useState('');
  const [namingStylePrompt, setNamingStylePrompt] = useState(
    () => localStorage.getItem(STORAGE_NAMING_STYLE) ?? '',
  );
  const [keyHint, setKeyHint] = useState('');
  const [configError, setConfigError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (useMock) return;
    let cancelled = false;
    void getBackendConfig()
      .then(res => {
        if (cancelled) return;
        const cfg = res.config;
        if (cfg.workspace_root) setWorkspace(cfg.workspace_root);
        if (typeof cfg.naming_style_prompt === 'string') {
          setNamingStylePrompt(cfg.naming_style_prompt);
          localStorage.setItem(STORAGE_NAMING_STYLE, cfg.naming_style_prompt);
        }
        if (cfg.ai_parser === 'llm' || cfg.ai_parser === 'mock') {
          setAiParser(cfg.ai_parser);
        }
        const llm = cfg.ai_parser_options?.llm;
        if (llm?.api_key_set && llm.api_key) {
          const vendor =
            llm.provider === DEEPSEEK_LLM.provider
              ? 'DeepSeek'
              : llm.provider || 'LLM';
          setKeyHint(`已配置 ${vendor} · ${llm.api_key}`);
        } else if (cfg.ai_parser === 'llm' && llm?.provider !== DEEPSEEK_LLM.provider) {
          setKeyHint(
            `当前解析引擎为 ${llm?.provider || '未知'}，点击保存将切换为 DeepSeek`,
          );
        }
      })
      .catch(() => {
        const cached = localStorage.getItem(STORAGE_LLM_KEY);
        if (!cancelled && cached) {
          setKeyHint('后端未连接；密钥暂存在本机浏览器，启动 uvicorn 后请再保存一次。');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [useMock]);

  async function handleSave() {
    setConfigError(null);
    setSuccessMsg(null);

    if (!useMock) {
      const baseErr = validateLocalApiBase(apiBase);
      if (baseErr) {
        setConfigError(baseErr);
        return;
      }
    }

    if (!useMock && aiParser === 'llm' && !hasAnyLlmKey(deepseekKey, keyHint)) {
      setConfigError('已选择 DeepSeek 大模型，请填写 API Key 后再保存。');
      return;
    }

    setSaving(true);
    try {
      localStorage.setItem(STORAGE_WORKSPACE, workspace.trim());
      localStorage.setItem('aidropzone.api_base', apiBase.trim());
      localStorage.setItem(STORAGE_NAMING_STYLE, namingStylePrompt);
      setMockModeOverride(useMock);

      if (deepseekKey.trim()) {
        localStorage.setItem(STORAGE_LLM_KEY, deepseekKey.trim());
      }

      let backendOk = false;
      if (!useMock) {
        try {
          const body: Parameters<typeof putBackendConfig>[0] = {
            workspace_root: workspace.trim() || undefined,
            ai_parser: aiParser,
            naming_style_prompt: namingStylePrompt,
          };
          if (aiParser === 'llm') {
            body.llm_provider = DEEPSEEK_LLM.provider;
            body.llm_model = DEEPSEEK_LLM.model;
            body.llm_base_url = DEEPSEEK_LLM.baseUrl;
            const apiKey = resolveLlmApiKeyForSave(deepseekKey);
            if (apiKey) {
              body.llm_api_key = apiKey;
            }
          }
          const res = await putBackendConfig(body);
          backendOk = true;
          const llm = res.config.ai_parser_options?.llm;
          if (llm?.api_key_set && llm.api_key) {
            setKeyHint(`已配置 DeepSeek · ${llm.api_key}`);
          } else if (aiParser === 'llm' && llm?.provider === DEEPSEEK_LLM.provider) {
            setKeyHint('已切换为 DeepSeek；请填写 API Key 后再次保存');
          }
          setDeepseekKey('');
        } catch (e) {
          const msg = e instanceof Error ? e.message : '保存到后端失败';
          if (isMissingConfigEndpointError(e)) {
            setSuccessMsg(
              '本地设置已保存。当前后端版本缺少 /config 接口，无法写入 backend/config.json；请切到包含配置接口的后端分支后再保存一次。',
            );
            if (deepseekKey.trim()) {
              setDeepseekKey('');
            }
            return;
          }
          if (deepseekKey.trim()) {
            setSuccessMsg('本地设置已保存；API Key 已写入浏览器。请启动 uvicorn 后再次点击保存以写入 config.json。');
            setConfigError(msg);
          } else {
            setConfigError(msg);
            return;
          }
        }
      } else if (deepseekKey.trim()) {
        setSuccessMsg('Mock 模式已开启；API Key 已暂存浏览器。关闭 Mock 并启动后端后请再保存一次。');
        setDeepseekKey('');
      }

      if (!successMsg) {
        setSuccessMsg(
          backendOk || useMock
            ? '保存成功。部分选项需刷新页面后生效。'
            : '本地设置已保存。',
        );
      }

      const needReload = useMock !== isMockMode();
      if (needReload) {
        window.setTimeout(() => window.location.reload(), 800);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <div className="flex items-center gap-2 border-b border-white/40 px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="electron-no-drag rounded-full p-1.5 text-slate-500 hover:bg-white/50 hover:text-slate-700"
          aria-label="返回"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-sm font-bold text-slate-800">设置</h2>
          <p className="text-[11px] text-slate-500">本地后端、DeepSeek 与整理篮</p>
        </div>
      </div>

      <div className="electron-no-drag flex-1 overflow-y-auto p-4">
        <label className="mb-2 flex cursor-pointer items-center gap-2 rounded-xl border border-white/55 bg-white/50 px-3 py-2.5">
          <input
            type="checkbox"
            checked={useMock}
            onChange={e => setUseMock(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-400"
          />
          <span className="text-sm text-slate-700">使用 Mock 模式（不请求本地后端）</span>
        </label>

        {!useMock && (
          <>
            <label className="mb-1.5 mt-3 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              <Server className="h-3.5 w-3.5" />
              本地后端地址（uvicorn）
            </label>
            <input
              value={apiBase}
              onChange={e => setApiBase(e.target.value)}
              placeholder="http://127.0.0.1:8000"
              className="mb-1 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mb-4 text-[11px] text-amber-800/90">
              只填本机 FastAPI，<strong>不要</strong>填 https://api.deepseek.com。
            </p>

            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
              隐私模式
            </label>
            <select
              value={aiParser}
              onChange={e => setAiParser(e.target.value as 'mock' | 'llm')}
              className="mb-4 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            >
              <option value="mock">隐私安全模式</option>
              <option value="llm">DeepSeek 大模型</option>
            </select>
          </>
        )}

        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <KeyRound className="h-3.5 w-3.5" />
          DeepSeek API Key
        </label>
        <input
          type="password"
          value={deepseekKey}
          onChange={e => setDeepseekKey(e.target.value)}
          placeholder="sk-…（你的密钥，保存后写入本机 config.json）"
          autoComplete="off"
          className="mb-1 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        {keyHint ? (
          <p className="mb-4 text-[11px] text-emerald-700">{keyHint}</p>
        ) : (
          <p className="mb-4 text-[11px] text-slate-400">
            在 platform.deepseek.com 创建密钥。保存时会同步写入后端 config.json（含 DeepSeek
            provider / model / base_url），与拖文件解析使用同一套 API。
          </p>
        )}

        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Sparkles className="h-3.5 w-3.5" />
          命名风格提示词（常驻）
        </label>
        <textarea
          value={namingStylePrompt}
          onChange={e => setNamingStylePrompt(e.target.value)}
          placeholder="例如：偏学术、保留英文缩写、文件名不超过 25 字符"
          maxLength={500}
          rows={3}
          className="mb-1 w-full resize-y rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
        <p className="mb-4 text-[11px] text-slate-400">
          保存后写入后端 config，每次解析与重新生成都会自动带上（关闭 Mock 且已启动 uvicorn 时生效）。
        </p>

        <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <FolderOpen className="h-3.5 w-3.5" />
          Workspace / 整理篮路径
        </label>
        <input
          value={workspace}
          onChange={e => setWorkspace(e.target.value)}
          placeholder="例如 D:\HCI_teamwork\HCI_Course_Design-AIDropzone\backend\workspace"
          className="mb-4 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />

        {configError && (
          <p className="mb-3 whitespace-pre-wrap rounded-xl border border-red-200/80 bg-red-50/90 px-3 py-2 text-[11px] text-red-800">
            {configError}
          </p>
        )}

        {successMsg && (
          <p className="mb-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 px-3 py-2 text-[11px] text-emerald-900">
            {successMsg}
          </p>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={() => void handleSave()}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? '保存中…' : '保存设置'}
        </button>
      </div>
    </motion.div>
  );
}
