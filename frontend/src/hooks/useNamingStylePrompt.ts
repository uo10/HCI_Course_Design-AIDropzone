import { useEffect, useState } from 'react';
import { getBackendConfig } from '../api/client';
import { isMockMode } from '../services/dropzoneApi';

const STORAGE_KEY = 'aidropzone.naming_style_prompt';

/** 后端 config 中的常驻命名风格；LLM 模式的 summary 通常不会写回「风格要求:」行 */
export function useNamingStylePrompt(): string {
  const [prompt, setPrompt] = useState(
    () => localStorage.getItem(STORAGE_KEY) ?? '',
  );

  useEffect(() => {
    if (isMockMode()) return;
    let cancelled = false;
    void getBackendConfig()
      .then(res => {
        if (cancelled) return;
        const p = res.config?.naming_style_prompt;
        if (typeof p === 'string') {
          setPrompt(p);
          localStorage.setItem(STORAGE_KEY, p);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return prompt;
}
