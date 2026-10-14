export type ClientBranch = { id: string; name: string; document: string; city: string; state: string; contactName: string; contactPhone: string; active: boolean };
type ClientWithBranches = { id: string; branches?: ClientBranch[] };

export const branchLabel = (branch: ClientBranch) =>
  branch.city ? `${branch.name} · ${branch.city}${branch.state ? `/${branch.state}` : ""}` : branch.name;

export const findBranch = (clients: ClientWithBranches[], clientId?: string, branchId?: string) =>
  branchId ? clients.find((client) => client.id === clientId)?.branches?.find((branch) => branch.id === branchId) : undefined;

// Campo de filial: só aparece quando o cliente escolhido tem filiais cadastradas.
// Filiais inativas continuam na lista apenas quando já estavam selecionadas.
export function BranchSelect({ clients, clientId, name = "branchId", value, defaultValue = "", onChange, className }: {
  clients: ClientWithBranches[];
  clientId?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const current = value ?? defaultValue;
  const branches = (clients.find((client) => client.id === clientId)?.branches || []).filter((branch) => branch.active || branch.id === current);
  if (!branches.length) return null;
  return (
    <label className={className}>
      Filial
      <select
        key={clientId}
        name={name}
        {...(value !== undefined ? { value } : { defaultValue: branches.some((branch) => branch.id === defaultValue) ? defaultValue : "" })}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">Matriz / sem filial</option>
        {branches.map((branch) => <option key={branch.id} value={branch.id}>{branchLabel(branch)}{branch.active ? "" : " (inativa)"}</option>)}
      </select>
    </label>
  );
}

// "Loja / Unidade" de chamados e reuniões (texto). Com filiais cadastradas, vira uma lista:
// Matriz e as filiais ativas; um valor antigo digitado à mão continua disponível.
export function UnitField({ branches = [], value, onChange, listId, suggestions = [], disabled, placeholder }: {
  branches?: ClientBranch[];
  value: string;
  onChange: (value: string) => void;
  listId: string;
  suggestions?: string[];
  disabled?: boolean;
  placeholder?: string;
}) {
  const names = branches.filter((branch) => branch.active || branch.name === value).map((branch) => branch.name);
  if (!names.length)
    return <><input list={listId} value={value} maxLength={80} disabled={disabled} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /><datalist id={listId}>{suggestions.map((unit) => <option key={unit} value={unit} />)}</datalist></>;
  const options = [...new Set(["Matriz", ...names, ...(value ? [value] : [])])];
  return (
    <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
      <option value="">Sem unidade</option>
      {options.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
    </select>
  );
}
