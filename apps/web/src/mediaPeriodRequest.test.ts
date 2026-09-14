import { afterEach, expect, it, vi } from "vitest";
import { requestMediaPeriod } from "./mediaPeriodRequest";
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
it("waits for an ongoing sync and then returns the requested period", async () => {
  vi.useFakeTimers();
  const fetcher=vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({code:"GOOGLE_SYNC_BUSY"}),{status:409})).mockResolvedValueOnce(new Response(JSON.stringify({campaigns:[{id:"1"}]})));
  vi.stubGlobal("fetch",fetcher);
  const result=requestMediaPeriod("/period",new AbortController().signal);
  await vi.advanceTimersByTimeAsync(1500);
  expect((await result).payload.campaigns).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(2);
});
it("does not retry authorization failures",async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({message:"Sem permissão"}),{status:403}));
  vi.stubGlobal("fetch",fetcher);
  expect((await requestMediaPeriod("/period",new AbortController().signal)).response.status).toBe(403);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it("does not start a request when the selected period was cancelled",async()=>{
  const fetcher=vi.fn();vi.stubGlobal("fetch",fetcher);const controller=new AbortController();controller.abort();
  await expect(requestMediaPeriod("/period",controller.signal)).rejects.toBeDefined();expect(fetcher).not.toHaveBeenCalled();
});
