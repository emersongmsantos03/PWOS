// Pontuação de otimização do Google Ads (0–100), enviada pela API como "NN% otimizada".
// Retorna null quando a campanha não tem essa pontuação (Meta Ads ou tipo sem suporte no Google).
export const googleOptimizationScore = (item: { optimizationStatus?: string | null }) => {
  const match = /^(\d{1,3})% otimizada$/.exec(item.optimizationStatus || "");
  return match ? Math.min(100, Number(match[1])) : null;
};
