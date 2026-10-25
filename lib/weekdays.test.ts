import { describe, expect, it } from "vitest";
import { parseWeekdays } from "./weekdays";

describe("parseWeekdays", () => {
  it.each([
    // Township page
    ["Monday & Wednesday", [1, 3]],
    ["Tuesday & Thursday", [2, 4]],
    ["Monday, Wednesday and Friday", [1, 3, 5]],
    ["Monday through Friday", [1, 2, 3, 4, 5]],
    // ActiveNet
    ["Wed", [3]],
    ["Mon, Tue, Wed, Thu", [1, 2, 3, 4]],
    ["Weekdays", [1, 2, 3, 4, 5]],
    ["Everyday", [0, 1, 2, 3, 4, 5, 6]],
    ["Sat-Sun", [0, 6]],
  ])("%s", (text, days) => expect(parseWeekdays(text)).toEqual(days));

  it.each(["Funday", "Mo", "", "Monday through"])("rejects %j", (text) => {
    expect(() => parseWeekdays(text)).toThrow();
  });
});
