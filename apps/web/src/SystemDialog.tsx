import { useState } from "react";
import type { ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import "./SystemDialog.css";

type DialogTone = "primary" | "warning" | "danger";
type ConfirmOptions = { title: string; message: string; confirmLabel?: string; cancelLabel?: string; tone?: DialogTone };
type PromptOptions = ConfirmOptions & { initialValue?: string; placeholder?: string; required?: boolean };

function mountDialog(render: (finish: (value: string | boolean | null) => void) => ReactNode) {
  const host = document.createElement("div");
  host.className = "system-dialog-host";
  document.body.appendChild(host);
  const root = createRoot(host);
  return new Promise<string | boolean | null>((resolve) => {
    const finish = (value: string | boolean | null) => {
      root.unmount();
      host.remove();
      resolve(value);
    };
    root.render(render(finish));
  });
}

function Dialog({ options, prompt, finish }: { options: PromptOptions; prompt?: boolean; finish: (value: string | boolean | null) => void }) {
  const [value, setValue] = useState(options.initialValue || ""), tone = options.tone || "primary";
  const Icon = tone === "danger" || tone === "warning" ? AlertTriangle : options.confirmLabel?.toLowerCase().includes("confirm") ? CheckCircle2 : Info;
  const submit = () => {
    if (prompt) {
      const result = value.trim();
      if (options.required && !result) return;
      finish(result || null);
    } else finish(true);
  };
  return <div className="system-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && finish(prompt ? null : false)}>
    <div className={`system-dialog tone-${tone}`} role="dialog" aria-modal="true" aria-labelledby="system-dialog-title">
      <div className="system-dialog-top"><span><Icon /></span><button type="button" aria-label="Fechar" onClick={() => finish(prompt ? null : false)}><X /></button></div>
      <div className="system-dialog-content"><h2 id="system-dialog-title">{options.title}</h2><p>{options.message}</p>{prompt && <input autoFocus value={value} placeholder={options.placeholder} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} />}</div>
      <div className="system-dialog-actions"><button type="button" className="system-dialog-cancel" onClick={() => finish(prompt ? null : false)}>{options.cancelLabel || "Cancelar"}</button><button type="button" className="system-dialog-confirm" disabled={prompt && options.required && !value.trim()} onClick={submit}>{options.confirmLabel || "Confirmar"}</button></div>
    </div>
  </div>;
}

export const systemConfirm = (options: ConfirmOptions) => mountDialog((finish) => <Dialog options={options} finish={finish} />).then(Boolean);
export const systemPrompt = (options: PromptOptions) => mountDialog((finish) => <Dialog options={options} prompt finish={finish} />).then((value) => typeof value === "string" ? value : null);
