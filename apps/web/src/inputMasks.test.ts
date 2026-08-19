import { describe, expect, it } from "vitest";
import { isValidDocument, maskCurrency, maskDocument, maskPhone, parseCurrency } from "./inputMasks";

describe("máscaras e documentos brasileiros",()=>{
  it("formata CPF, CNPJ e telefone",()=>{
    expect(maskDocument("52998224725")).toBe("529.982.247-25");
    expect(maskDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(maskPhone("41999999999")).toBe("(41) 99999-9999");
  });
  it("valida dígitos verificadores",()=>{
    expect(isValidDocument("529.982.247-25")).toBe(true);
    expect(isValidDocument("11.222.333/0001-81")).toBe(true);
    expect(isValidDocument("111.111.111-11")).toBe(false);
    expect(isValidDocument("11.222.333/0001-00")).toBe(false);
  });
  it("formata e converte valores monetários brasileiros",()=>{
    expect(maskCurrency("3000")).toBe("R$ 3.000,00");
    expect(maskCurrency("R$ 3.000,50")).toBe("R$ 3.000,50");
    expect(parseCurrency("R$ 3.000,50")).toBe(3000.5);
  });
});
