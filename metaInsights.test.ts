import { describe, expect, it } from "vitest";
import { extractMetaLeads } from "./metaInsights";

describe("extractMetaLeads", () => {
  it("uses a direct lead action when Meta returns it", () => {
    expect(extractMetaLeads([{ action_type: "lead", value: "12" }])).toEqual({
      leads: 12,
      actionType: "lead",
    });
  });

  it("uses conversations started for messaging-result campaigns", () => {
    expect(
      extractMetaLeads([
        { action_type: "onsite_conversion.total_messaging_connection", value: "37" },
        { action_type: "onsite_conversion.messaging_first_reply", value: "28" },
        { action_type: "onsite_conversion.messaging_conversation_started_7d", value: "31" },
      ]),
    ).toEqual({
      leads: 31,
      actionType: "onsite_conversion.messaging_conversation_started_7d",
    });
  });

  it("does not add overlapping lead aliases", () => {
    expect(
      extractMetaLeads([
        { action_type: "lead", value: "10" },
        { action_type: "onsite_conversion.lead_grouped", value: "10" },
        { action_type: "offsite_conversion.fb_pixel_lead", value: "10" },
      ]).leads,
    ).toBe(10);
  });

  it("returns zero safely when there is no supported result", () => {
    expect(extractMetaLeads([{ action_type: "link_click", value: "40" }])).toEqual({
      leads: 0,
      actionType: null,
    });
  });
});
