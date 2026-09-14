import { expect, it } from "vitest";
import { forEachConcurrent } from "./asyncPool";
it("processes every account once with bounded concurrency", async () => {
  let active = 0, peak = 0; const processed: number[] = [];
  await forEachConcurrent([1,2,3,4,5,6], 3, async item => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    processed.push(item); active--;
  });
  expect(peak).toBe(3); expect(processed.sort()).toEqual([1,2,3,4,5,6]);
});
it("waits for started work and propagates failure without starting more accounts", async () => {
  const started: number[] = []; let settled = false;
  await expect(forEachConcurrent([1,2,3,4], 2, async item => {
    started.push(item);
    if(item===1) throw new Error("Google unavailable");
    await new Promise(resolve => setTimeout(resolve, 5)); settled=true;
  })).rejects.toThrow("Google unavailable");
  expect(started).toEqual([1,2]); expect(settled).toBe(true);
});
