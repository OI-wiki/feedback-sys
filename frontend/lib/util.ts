export const groupBy = function <K extends string, T>(
  arr: T[],
  func: (el: T) => K,
) {
  return arr.reduce(
    (acc, x) => {
      (acc[func(x)] = acc[func(x)] || []).push(x);
      return acc;
    },
    {} as {
      [key: string]: T[];
    },
  );
};

export const dateTimeFormatter = new Intl.DateTimeFormat("zh-CN", {
  dateStyle: "short",
  timeStyle: "short",
});
