import { describe, expect, it } from "vitest";
import { dayGroupLabel, displayStatus, groupByDay, meetingThemes, overallPerception, type Meeting } from "./meetingsModel";

const perception = (value: Partial<Meeting["perception"]>) => ({ perception: { satisfaction: "", contactQuality: "", contactVolume: "", commercialService: "", churnRisk: "", expansionPotential: "", notes: "", ...value } });
const meeting = (value: Partial<Meeting>) => ({ status: "SCHEDULED", durationMinutes: 30, startAt: "2026-08-23T13:00:00.000Z", subject: "", agenda: [], ...value }) as Meeting;

describe("percepção consolidada da reunião", () => {
  it("fica vazia enquanto nada foi preenchido", () => expect(overallPerception(perception({ expansionPotential: "HIGH" }))).toBe(""));
  it("é positiva com satisfação positiva mesmo que o volume possa melhorar", () => expect(overallPerception(perception({ satisfaction: "POSITIVE", contactVolume: "IMPROVE", churnRisk: "LOW" }))).toBe("POSITIVE"));
  it("pede acompanhamento quando algum indicador está ruim", () => expect(overallPerception(perception({ satisfaction: "POSITIVE", contactQuality: "BAD" }))).toBe("ATTENTION"));
  it("marca insatisfação com risco alto de cancelamento", () => expect(overallPerception(perception({ satisfaction: "NEUTRAL", churnRisk: "HIGH" }))).toBe("NEGATIVE"));
});

describe("listas de reuniões", () => {
  it("mostra como não iniciada a reunião agendada cujo horário já passou", () => {
    expect(displayStatus(meeting({}), Date.parse("2026-08-23T14:00:00.000Z")).label).toBe("Não iniciada");
    expect(displayStatus(meeting({}), Date.parse("2026-08-23T12:00:00.000Z")).label).toBe("Agendada");
  });
  it("agrupa por dia e rotula hoje e amanhã", () => {
    const today = new Date(2026, 7, 24, 9);
    expect(dayGroupLabel("2026-08-24", today)).toBe("Hoje — 24 de Agosto de 2026 (Segunda-feira)");
    expect(dayGroupLabel("2026-08-25", today)).toBe("Amanhã — 25 de Agosto de 2026 (Terça-feira)");
    expect(dayGroupLabel("2026-08-26", today)).toBe("Quarta-feira — 26 de Agosto de 2026");
    const groups = groupByDay([meeting({ id: "b", startAt: new Date(2026, 7, 24, 10).toISOString() }), meeting({ id: "a", startAt: new Date(2026, 7, 23, 10).toISOString() })]);
    expect(groups.map(([day]) => day)).toEqual(["2026-08-23", "2026-08-24"]);
  });
  it("classifica assuntos pela pauta e pelos itens tratados", () => {
    expect(meetingThemes(meeting({ subject: "Revisão de campanhas", agenda: [{ id: "1", label: "Novos criativos e materiais", done: true }, { id: "2", label: "Oportunidades de expansão", done: false }] }))).toEqual(["Campanhas", "Criativos"]);
  });
});
