// Trabalho de quem executa uma etapa — compartilhado entre a API (vite.config.ts) e a interface.
// A etapa ativa tem um cronômetro: iniciar, pausar, retomar e finalizar. Finalizada, a etapa
// pode ser enviada para a próxima (aprovação interna, cliente…), que é a ação COMPLETE do fluxo.

export type TicketWorkState = "NOT_STARTED" | "RUNNING" | "PAUSED" | "FINISHED";
export type TicketWork = {
  state: TicketWorkState;
  // Tempo já trabalhado nas sessões encerradas (pausas não contam).
  elapsedMs: number;
  runningSince?: string;
  firstStartedAt?: string;
  finishedAt?: string;
  // Rascunho do comentário de entrega, salvo por quem executa a etapa.
  draft?: string;
};
export type TicketWorkAction = "START" | "PAUSE" | "RESUME" | "FINISH" | "REOPEN" | "DRAFT";
export type TicketChecklistItem = { id: string; text: string; done: boolean; stepId?: string; doneAt?: string; doneByName?: string };

export const emptyWork = (): TicketWork => ({ state: "NOT_STARTED", elapsedMs: 0 });

// Tempo trabalhado até agora, contando a sessão em andamento.
export const workElapsed = (work: TicketWork | undefined, now = new Date()) =>
  !work ? 0 : work.elapsedMs + (work.state === "RUNNING" && work.runningSince ? Math.max(0, now.getTime() - new Date(work.runningSince).getTime()) : 0);

export const formatWorkTime = (ms: number) => {
  const minutes = Math.floor(ms / 60000), hours = Math.floor(minutes / 60);
  return `${String(hours).padStart(2, "0")}h ${String(minutes % 60).padStart(2, "0")}min`;
};

// Encerra a sessão em andamento, somando o tempo trabalhado.
const stopClock = (work: TicketWork, now: Date): TicketWork => ({
  ...work, elapsedMs: workElapsed(work, now), runningSince: undefined,
});

export function applyWorkAction(current: TicketWork | undefined, action: TicketWorkAction, now: Date, draft = ""): TicketWork {
  const work = current || emptyWork(), at = now.toISOString();
  switch (action) {
    case "START":
    case "RESUME":
      if (work.state === "RUNNING") return work;
      if (work.state === "FINISHED") throw new Error("Esta etapa já foi finalizada. Reabra para continuar.");
      return { ...work, state: "RUNNING", runningSince: at, firstStartedAt: work.firstStartedAt || at };
    case "PAUSE":
      if (work.state !== "RUNNING") throw new Error("A etapa não está em produção.");
      return { ...stopClock(work, now), state: "PAUSED" };
    case "FINISH":
      if (work.state === "NOT_STARTED") throw new Error("Inicie a produção antes de finalizar a etapa.");
      if (work.state === "FINISHED") return work;
      return { ...stopClock(work, now), state: "FINISHED", finishedAt: at };
    case "REOPEN":
      if (work.state !== "FINISHED") return work;
      return { ...work, state: "PAUSED", finishedAt: undefined };
    case "DRAFT":
      return { ...work, draft: draft.trim().slice(0, 2000) };
  }
}

// Quando a etapa sai de quem executa (enviada ou devolvida), o cronômetro para.
export const closeWork = (work: TicketWork | undefined, now: Date): TicketWork | undefined =>
  work && work.state === "RUNNING" ? { ...stopClock(work, now), state: "PAUSED" } : work;

// Etapa devolvida para ajustes: volta a "não iniciada", mantendo o tempo já trabalhado.
export const reopenWorkForAdjustment = (work: TicketWork | undefined): TicketWork =>
  ({ ...(work || emptyWork()), state: "NOT_STARTED", runningSince: undefined, finishedAt: undefined });

export const workStateLabels: Record<TicketWorkState, string> = {
  NOT_STARTED: "Não iniciada", RUNNING: "Em produção", PAUSED: "Pausada", FINISHED: "Finalizada",
};
