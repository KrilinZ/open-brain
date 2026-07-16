// Tipo compartido de la configuración del Brain (config.json sanitizado por el main).
// El renderer NUNCA recibe la key en claro (salvo revealConfigKey, bajo click explícito).
export interface BrainConfig {
  version: number;
  openrouter: {
    model: string;
    baseUrl: string;
    enabled: boolean;
    hasKey: boolean;
    apiKeyMasked: string | null;
  };
  paths: { base: string; knowledge: string };
  flags: {
    onlyLocalEmbeddings: boolean;
    autoIngest: boolean;
    launchAtLogin: boolean;
    keyEncryption: boolean;
  };
  brain: {
    maxSpendPerSessionUsd: number;
    temperature: number;
    maxTokens: number;
    privacy: {
      localOnly: boolean;
      sendKiContext: boolean;
      redactOutbound: boolean;
      maxContextChars: number;
    };
  };
  onboarding: { completed: boolean; completedAt: string | null };
}

export const FALLBACK_MODELS: { id: string; name: string }[] = [
  { id: "openai/gpt-4o-mini", name: "GPT-4o mini · barato" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet · calidad" },
  { id: "anthropic/claude-3.5-haiku", name: "Claude 3.5 Haiku" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "google/gemini-flash-1.5", name: "Gemini 1.5 Flash" },
  { id: "meta-llama/llama-3.1-70b-instruct", name: "Llama 3.1 70B" },
];
