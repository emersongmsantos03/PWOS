import { useMemo, useState, type ComponentType } from "react";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ExternalLink,
  HelpCircle,
  KanbanSquare,
  LifeBuoy,
  Megaphone,
  MessageSquare,
  PlayCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { NavLink } from "react-router-dom";

type HelpUser = { permissions: string[]; profile: string };
type Article = {
  category: string;
  title: string;
  text: string;
  steps: string[];
  permission?: string;
};

const articles: Article[] = [
  {
    category: "Primeiros passos",
    title: "Começando no PW OS",
    text: "Conheça a ordem recomendada para configurar a equipe, os clientes e a operação.",
    steps: [
      "Complete seus dados no menu da conta.",
      "Cadastre os colaboradores, cargos e permissões em Equipe & acesso.",
      "Cadastre os clientes e conecte as plataformas utilizadas pela operação.",
      "Organize oportunidades, tarefas, agenda e indicadores.",
    ],
  },
  {
    category: "Primeiros passos",
    title: "Acesso ao Portal do Cliente",
    text: "O cliente consulta suas campanhas Meta Ads e Google Ads em uma área exclusiva.",
    steps: [
      "Abra /portal-cliente no endereço do PW OS.",
      "Entre com o e-mail e a senha temporária recebidos.",
      "Crie uma senha definitiva no primeiro acesso.",
      "Caso não existam campanhas, confirme o vínculo do cliente com a conta de mídia.",
    ],
  },
  {
    category: "CRM e clientes",
    title: "Organizar o funil comercial",
    text: "Acompanhe oportunidades por etapa, responsável, valor e histórico comercial.",
    permission: "crm.view",
    steps: [
      "Abra CRM's e selecione o funil desejado.",
      "Crie uma oportunidade e informe os dados comerciais.",
      "Mova a oportunidade entre as etapas conforme a negociação avançar.",
      "Registre atividades, propostas e a conversão ou perda da oportunidade.",
    ],
  },
  {
    category: "CRM e clientes",
    title: "Cadastrar e vincular clientes",
    text: "Centralize dados cadastrais, responsáveis, acessos e vínculos operacionais.",
    permission: "clients.view",
    steps: [
      "Abra Clientes e localize ou cadastre a empresa.",
      "Revise os dados, o responsável e os usuários com acesso.",
      "Use as integrações ou a Mídia paga para vincular as contas corretas.",
      "Somente usuários autorizados verão ações de vínculo e desvínculo.",
    ],
  },
  {
    category: "Operação",
    title: "Creative Ops e tarefas",
    text: "Organize demandas, briefing, prazo, prioridade, responsáveis e aprovações.",
    permission: "creative_ops.view",
    steps: [
      "Crie a demanda com título, responsável e prazo.",
      "Complete briefing, cliente e tipo de trabalho quando necessário.",
      "Use comentários, checklist e anexos durante a execução.",
      "Mova a tarefa pelo fluxo até a conclusão e aprovação.",
    ],
  },
  {
    category: "Operação",
    title: "Agenda individual e da equipe",
    text: "Consulte compromissos por dia, semana ou mês dentro do seu escopo de acesso.",
    permission: "calendar.view",
    steps: [
      "Abra Agenda e escolha a visualização desejada.",
      "Navegue entre os períodos ou volte para Hoje.",
      "Crie ou edite compromissos quando possuir a permissão correspondente.",
      "A visualização se adapta quando existe apenas uma agenda disponível.",
    ],
  },
  {
    category: "Mídia paga",
    title: "Sincronização das campanhas",
    text: "As campanhas são atualizadas em segundo plano e podem ser sincronizadas manualmente.",
    permission: "media.view",
    steps: [
      "Acesse Mídia paga para consultar os dados já armazenados, sem aguardar uma nova carga.",
      "O sistema atualiza as contas conectadas automaticamente a cada 30 minutos.",
      "Use Sincronizar para solicitar uma atualização imediata.",
      "O botão e a API só aceitam a ação quando a permissão Sincronizar estiver ativa.",
    ],
  },
  {
    category: "Mídia paga",
    title: "Filtros, contas e campanhas",
    text: "Consulte Meta Ads e Google Ads por período, status, entrega, cliente ou campanha.",
    permission: "media.view",
    steps: [
      "Selecione a plataforma e o período de análise.",
      "Use a busca e os filtros de status e entrega para reduzir os resultados.",
      "Expanda uma conta para consultar indicadores e campanhas.",
      "Os filtros usam controles padronizados em Windows e macOS.",
    ],
  },
  {
    category: "Mídia paga",
    title: "Vincular cliente e responsável",
    text: "Associe contas de anúncios ao cliente e ao responsável pela operação.",
    permission: "media.edit",
    steps: [
      "Expanda a conta desejada e abra Vincular cliente e responsável.",
      "Escolha o cliente ou o portfólio Meta.",
      "Selecione o responsável e salve o vínculo.",
      "Sem permissão de gerenciamento, essa opção não será exibida.",
    ],
  },
  {
    category: "Relatórios",
    title: "Filtrar e organizar os relatórios",
    text: "Analise indicadores executivos, comerciais, operacionais e financeiros.",
    permission: "reports.view",
    steps: [
      "Abra Relatórios e escolha a área de análise.",
      "Defina período, cliente e responsável nos filtros superiores.",
      "Use a busca para localizar indicadores e informações.",
      "Gráficos, indicadores, equipe e alertas respeitam o seu nível de acesso.",
    ],
  },
  {
    category: "Relatórios",
    title: "Exportar dados em CSV",
    text: "Gere uma planilha com os dados disponíveis no seu escopo de permissão.",
    permission: "reports.download",
    steps: [
      "Aplique o período, cliente e responsável desejados.",
      "Revise os indicadores apresentados na tela.",
      "Clique em Exportar CSV.",
      "O arquivo inclui somente informações que você possui permissão para visualizar.",
    ],
  },
  {
    category: "Financeiro",
    title: "Dashboard e lançamentos financeiros",
    text: "Controle receitas, despesas, vencimentos, baixas e projeções.",
    permission: "finance.view",
    steps: [
      "Cadastre contas e categorias nas configurações financeiras.",
      "Registre receitas e despesas com seus vencimentos.",
      "Confirme as baixas para atualizar o saldo realizado.",
      "Use filtros e indicadores para acompanhar o fluxo financeiro.",
    ],
  },
  {
    category: "Chamados",
    title: "Abrir e acompanhar um chamado",
    text: "Cada tipo de solicitação cria um fluxo de etapas com responsáveis, aprovações e prazos.",
    permission: "tickets.view",
    steps: [
      "Em Chamados → Abrir chamado, escolha o cliente, a origem e o tipo de solicitação (Landing Page, Peça criativa, Chamado simples…).",
      "O tipo monta as etapas do fluxo; quem tem permissão de atribuir pode trocar o responsável de cada etapa.",
      "O chamado aparece em Chamados › Em andamento (filtro \"Comigo agora\") de quem está com a etapa atual. Ao concluir, ele segue para a próxima etapa e avisa o próximo responsável.",
      "Etapas de aprovação podem devolver o chamado para ajustes; tudo fica registrado no histórico do chamado.",
    ],
  },
  {
    category: "Chamados",
    title: "Permissões dos chamados internos",
    text: "Cada ação possui uma autorização independente para proteger o atendimento.",
    permission: "tickets.view",
    steps: [
      "Visualizar limita a consulta aos chamados em que você participa; Visualizar todos amplia o escopo.",
      "Criar, Editar, Excluir e Comentar controlam separadamente cada ação.",
      "Atribuir permite escolher ou trocar o responsável de cada etapa do chamado.",
      "Gerenciar setores permite cadastrar, editar e organizar os setores de atendimento.",
    ],
  },
  {
    category: "Segurança",
    title: "Cargos, usuários e permissões",
    text: "Defina exatamente o que cada pessoa pode visualizar e alterar.",
    permission: "users.view",
    steps: [
      "Abra Equipe & acesso e selecione um cargo ou usuário.",
      "Revise as permissões por módulo e as ações extras.",
      "Salve as alterações e teste o acesso com o perfil correspondente.",
      "Botões ocultos também permanecem protegidos pelos endpoints do sistema.",
    ],
  },
  {
    category: "Configurações",
    title: "Conectar plataformas e contas",
    text: "Gerencie integrações, autorizações, contas conectadas e registros de sincronização.",
    permission: "integrations.view",
    steps: [
      "Abra a Central de Conexões.",
      "Escolha a plataforma e conclua a autorização solicitada.",
      "Selecione as contas que farão parte da operação.",
      "Consulte os registros para acompanhar sincronizações e eventuais falhas.",
    ],
  },
  {
    category: "Configurações",
    title: "Tema, conta e notificações",
    text: "Personalize a experiência e mantenha seus dados de acesso atualizados.",
    permission: "settings.view",
    steps: [
      "Abra Configurações pelo menu lateral.",
      "Escolha o tema e as preferências disponíveis.",
      "Use o menu da conta para atualizar perfil e segurança.",
      "Revise as notificações para acompanhar eventos importantes da operação.",
    ],
  },
];

const categories: [ComponentType, string][] = [
  [Sparkles, "Primeiros passos"],
  [KanbanSquare, "CRM e clientes"],
  [CheckCircle2, "Operação"],
  [Megaphone, "Mídia paga"],
  [BarChart3, "Relatórios"],
  [CircleDollarSign, "Financeiro"],
  [MessageSquare, "Chamados"],
  [ShieldCheck, "Segurança"],
  [Settings, "Configurações"],
];

export function HelpCenter({ user }: { user: HelpUser }) {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("Todos"),
    [open, setOpen] = useState<string | null>(null);
  const can = (permission?: string) =>
    !permission ||
    user.profile === "MASTER" ||
    user.permissions.includes(permission);
  const availableArticles = useMemo(
    () => articles.filter((article) => can(article.permission)),
    [user.permissions, user.profile],
  );
  const availableCategories = categories.filter(([, label]) =>
    availableArticles.some((article) => article.category === label),
  );
  const visible = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return availableArticles.filter(
      (article) =>
        (category === "Todos" || article.category === category) &&
        (!term ||
          `${article.title} ${article.text} ${article.category} ${article.steps.join(" ")}`
            .toLocaleLowerCase("pt-BR")
            .includes(term)),
    );
  }, [availableArticles, category, search]);

  return (
    <div className="help-page">
      <section className="help-hero">
        <span className="eyebrow">CENTRAL DE AJUDA PW OS</span>
        <h1>Como podemos ajudar?</h1>
        <p>Respostas atualizadas para os recursos disponíveis no seu acesso.</p>
        <div className="help-search">
          <Search />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Busque por campanha, relatório, chamado ou processo..."
          />
          <kbd>⌘ K</kbd>
        </div>
        <div className="help-status">
          <i />
          <span>
            <b>Conteúdo protegido</b> De acordo com suas permissões
          </span>
        </div>
      </section>
      <main className="help-content">
        <section className="help-quick">
          {can("tickets.create") && (
            <NavLink to="/chamados">
              <span>
                <MessageSquare />
              </span>
              <div>
                <b>Abrir um chamado</b>
                <small>Solicite ajuda e acompanhe o atendimento</small>
              </div>
              <ChevronRight />
            </NavLink>
          )}
          {can("reports.view") && (
            <NavLink to="/relatorios">
              <span>
                <BarChart3 />
              </span>
              <div>
                <b>Consultar relatórios</b>
                <small>Filtre indicadores dentro do seu acesso</small>
              </div>
              <ChevronRight />
            </NavLink>
          )}
          {can("settings.view") && (
            <NavLink to="/configuracoes">
              <span>
                <Settings />
              </span>
              <div>
                <b>Configurar meu ambiente</b>
                <small>Tema, conta e notificações</small>
              </div>
              <ChevronRight />
            </NavLink>
          )}
          <a href="mailto:suporte@pwmedia.com.br">
            <span>
              <LifeBuoy />
            </span>
            <div>
              <b>Falar com o suporte</b>
              <small>Envie um e-mail para a equipe PW</small>
            </div>
            <ExternalLink />
          </a>
        </section>
        <section className="help-layout">
          <aside>
            <h2>Explorar por tema</h2>
            <button
              className={category === "Todos" ? "active" : ""}
              onClick={() => setCategory("Todos")}
            >
              <BookOpen />
              Todos os artigos<span>{availableArticles.length}</span>
            </button>
            {availableCategories.map(([Icon, label]) => (
              <button
                className={category === label ? "active" : ""}
                key={label}
                onClick={() => setCategory(label)}
              >
                <Icon />
                {label}
                <span>
                  {
                    availableArticles.filter((item) => item.category === label)
                      .length
                  }
                </span>
              </button>
            ))}
          </aside>
          <div className="help-results">
            <header>
              <div>
                <h2>
                  {search
                    ? `Resultados para “${search}”`
                    : category === "Todos"
                      ? "Artigos recomendados"
                      : category}
                </h2>
                <p>{visible.length} conteúdo(s) encontrado(s)</p>
              </div>
              {can("tickets.create") && (
                <NavLink to="/chamados">
                  Ainda precisa de ajuda? <ChevronRight />
                </NavLink>
              )}
            </header>
            {visible.map((article) => (
              <article
                className={open === article.title ? "open" : ""}
                key={article.title}
              >
                <button
                  onClick={() =>
                    setOpen((current) =>
                      current === article.title ? null : article.title,
                    )
                  }
                >
                  <span>
                    <small>{article.category}</small>
                    <b>{article.title}</b>
                    <p>{article.text}</p>
                  </span>
                  <ChevronDown />
                </button>
                {open === article.title && (
                  <div>
                    <h3>Passo a passo</h3>
                    <ol>
                      {article.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <footer>
                      <span>
                        <CheckCircle2 /> Conteúdo atualizado
                      </span>
                      {can("tickets.create") && (
                        <NavLink to="/chamados">
                          Abrir chamado <ExternalLink />
                        </NavLink>
                      )}
                    </footer>
                  </div>
                )}
              </article>
            ))}
            {!visible.length && (
              <div className="help-empty">
                <HelpCircle />
                <h2>Nenhum conteúdo encontrado</h2>
                <p>Tente buscar por outro termo.</p>
                <button
                  onClick={() => {
                    setSearch("");
                    setCategory("Todos");
                  }}
                >
                  Limpar busca
                </button>
              </div>
            )}
          </div>
        </section>
        <section className="help-guide">
          <div>
            <PlayCircle />
            <span>
              <b>Novo no PW OS?</b>
              <p>Siga a jornada recomendada para organizar sua operação.</p>
            </span>
          </div>
          <ol>
            <li>
              <span>1</span>
              <b>
                Configure a conta<small>Perfil, senha e aparência</small>
              </b>
            </li>
            <li>
              <span>2</span>
              <b>
                Organize a equipe<small>Cargos, setores e permissões</small>
              </b>
            </li>
            <li>
              <span>3</span>
              <b>
                Conecte a operação<small>Clientes, CRM e plataformas</small>
              </b>
            </li>
            <li>
              <span>4</span>
              <b>
                Acompanhe resultados
                <small>Mídia, financeiro e relatórios</small>
              </b>
            </li>
          </ol>
        </section>
      </main>
    </div>
  );
}
