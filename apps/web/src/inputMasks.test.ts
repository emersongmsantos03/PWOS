import { describe, expect, it } from "vitest";
import { isValidDocument, maskDocument, maskPhone } from "./inputMasks";

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
});
