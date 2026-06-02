import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, FolderOpen, KeyRound, RefreshCw, Save, Server } from 'lucide-react';
import { getBackendConfig, putBackendConfig } from '../api/client';
import {
  getApiBase,
  isMockMode,
  setMockModeOverride,
} from '../services/dropzoneApi';
import { validateLocalApiBase } from '../utils/apiErrors';

const STORAGE_WORKSPACE = 'aidropzone.workspace';
const STORAGE_LLM_KEY = 'aidropzone.llm_api_key';

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
        if (cfg.ai_parser === 'llm' || cfg.ai_parser === 'mock') {
          setAiParser(cfg.ai_parser);
        }
        const llm = cfg.ai_parser_options?.llm;
        if (llm?.api_key_set && llm.api_key) {
          setKeyHint(`已保存：${llm.api_key}`);
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

    if (aiParser === 'llm' && !deepseekKey.trim() && !keyHint && !localStorage.getItem(STORAGE_LLM_KEY)) {
      setConfigError('已选择 DeepSeek 大模型，请填写 API Key 后再保存。');
      return;
    }

    setSaving(true);
    try {
      localStorage.setItem(STORAGE_WORKSPACE, workspace.trim());
      localStorage.setItem('aidropzone.api_base', apiBase.trim());
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
          };
          if (deepseekKey.trim()) {
            body.llm_api_key = deepseekKey.trim();
          }
          const res = await putBackendConfig(body);
          backendOk = true;
          const llm = res.config.ai_parser_options?.llm;
          if (llm?.api_key_set && llm.api_key) {
            setKeyHint(`已保存：${llm.api_key}`);
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
              AI 解析引擎
            </label>
            <select
              value={aiParser}
              onChange={e => setAiParser(e.target.value as 'mock' | 'llm')}
              className="mb-4 w-full rounded-xl border border-slate-200/80 bg-white/70 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-400"
            >
              <option value="mock">规则 Mock（不消耗 DeepSeek）</option>
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
            在 platform.deepseek.com 创建密钥。关闭 Mock 且启动 uvicorn 后，保存会写入后端配置。
          </p>
        )}

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
