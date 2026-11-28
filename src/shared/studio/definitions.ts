export const labels = [
  "Architecture",
  "Interiors",
  "Coordination",
  "Site visit",
  "Needs attention",
] as const;
export const taskTemplates = [
  {
    name: "Site visit",
    title: "Weekly site review",
    checklist: [
      "Review site observations",
      "Record photographs and measurements",
      "Prepare follow-up actions",
    ],
  },
  {
    name: "Drawing coordination",
    title: "Coordinate drawing package",
    checklist: [
      "Check current drawing revisions",
      "Review consultant comments",
      "Prepare for manager review",
    ],
  },
  {
    name: "Consultant follow-up",
    title: "Follow up on consultant review",
    checklist: [
      "Confirm exact version under review",
      "Record consultant response",
      "Update coordination tasks",
    ],
  },
  {
    name: "Client update",
    title: "Prepare project update",
    checklist: [
      "Summarise completed work",
      "Confirm next actions",
      "Submit update for manager publication",
    ],
  },
] as const;
export type RuleDefinition = {
  version: 1;
  trigger:
    | "WEEKLY"
    | "TASK_COMPLETED"
    | "DUE_SOON"
    | "OVERDUE"
    | "DRAWING_RELEASED";
  weekday: number;
  hour: number;
  condition: { label?: string };
  actions: {
    type: "CREATE_TASK" | "REMIND" | "LABEL";
    title: string;
    assigneeId?: string;
    dueDays: number;
    label?: string;
  }[];
};
export function validateRule(value: unknown): RuleDefinition {
  const v = value as RuleDefinition;
  if (
    !v ||
    v.version !== 1 ||
    ![
      "WEEKLY",
      "TASK_COMPLETED",
      "DUE_SOON",
      "OVERDUE",
      "DRAWING_RELEASED",
    ].includes(v.trigger) ||
    !Number.isInteger(v.weekday) ||
    v.weekday < 0 ||
    v.weekday > 6 ||
    !Number.isInteger(v.hour) ||
    v.hour < 0 ||
    v.hour > 23 ||
    !v.condition ||
    Object.keys(v.condition).some((k) => k !== "label") ||
    (v.condition.label !== undefined &&
      !labels.includes(v.condition.label as (typeof labels)[number])) ||
    !Array.isArray(v.actions) ||
    v.actions.length < 1 ||
    v.actions.length > 3 ||
    Object.keys(v).some(
      (k) =>
        ![
          "version",
          "trigger",
          "weekday",
          "hour",
          "condition",
          "actions",
        ].includes(k),
    )
  )
    throw new Error("Choose a supported trigger and one to three actions.");
  for (const a of v.actions) {
    if (
      !a ||
      !["CREATE_TASK", "REMIND", "LABEL"].includes(a.type) ||
      typeof a.title !== "string" ||
      !a.title.trim() ||
      a.title.length > 300 ||
      !Number.isInteger(a.dueDays) ||
      a.dueDays < 0 ||
      a.dueDays > 90 ||
      (a.assigneeId !== undefined &&
        (typeof a.assigneeId !== "string" || a.assigneeId.length > 100)) ||
      (a.label !== undefined &&
        !labels.includes(a.label as (typeof labels)[number])) ||
      Object.keys(a).some(
        (k) => !["type", "title", "assigneeId", "dueDays", "label"].includes(k),
      ) ||
      (a.type === "LABEL" &&
        (!a.label || ["WEEKLY", "DRAWING_RELEASED"].includes(v.trigger)))
    )
      throw new Error("Choose valid task, reminder or label actions.");
  }
  return v;
}
// Weekly schedules use the practice's Asia/Kolkata business clock. Queue delays are not a scheduler.
export function nextWeekly(d: RuleDefinition, after: number): number {
  const offset = 19800000;
  const local = new Date(after + offset);
  const day = new Date(
    Date.UTC(
      local.getUTCFullYear(),
      local.getUTCMonth(),
      local.getUTCDate(),
      d.hour,
    ),
  );
  day.setUTCDate(day.getUTCDate() + ((d.weekday - local.getUTCDay() + 7) % 7));
  if (day.getTime() - offset <= after) day.setUTCDate(day.getUTCDate() + 7);
  return day.getTime() - offset;
}
export function ruleSentence(d: RuleDefinition) {
  const trigger = {
    WEEKLY: `Every ${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.weekday]} at ${String(d.hour).padStart(2, "0")}:00 IST`,
    TASK_COMPLETED: "When a task is completed",
    DUE_SOON: "Two days before a task is due",
    OVERDUE: "When a task becomes overdue",
    DRAWING_RELEASED: "When a drawing is released",
  }[d.trigger];
  return `${trigger}${d.condition.label ? ` with ${d.condition.label}` : ""}, ${d.actions.map((a) => (a.type === "CREATE_TASK" ? `create “${a.title}”` : a.type === "LABEL" ? `add ${a.label}` : `remind “${a.title}”`)).join(" and ")}.`;
}
export const ruleTemplates: { name: string; definition: RuleDefinition }[] = [
  {
    name: "Weekly site review",
    definition: {
      version: 1,
      trigger: "WEEKLY",
      weekday: 1,
      hour: 9,
      condition: {},
      actions: [
        { type: "CREATE_TASK", title: "Weekly site review", dueDays: 2 },
      ],
    },
  },
  {
    name: "Due date reminder",
    definition: {
      version: 1,
      trigger: "DUE_SOON",
      weekday: 1,
      hour: 9,
      condition: {},
      actions: [
        { type: "REMIND", title: "Your task is due in two days", dueDays: 0 },
      ],
    },
  },
  {
    name: "Coordination handoff",
    definition: {
      version: 1,
      trigger: "TASK_COMPLETED",
      weekday: 1,
      hour: 9,
      condition: { label: "Coordination" },
      actions: [
        {
          type: "CREATE_TASK",
          title: "Review coordinated package",
          dueDays: 2,
        },
      ],
    },
  },
  {
    name: "Drawing follow-up",
    definition: {
      version: 1,
      trigger: "DRAWING_RELEASED",
      weekday: 1,
      hour: 9,
      condition: {},
      actions: [
        {
          type: "REMIND",
          title: "Prepare a manual WhatsApp update for the released drawing",
          dueDays: 0,
        },
      ],
    },
  },
];
export const ruleJSONSchema = {
  type: "object",
  additionalProperties: false,
  required: ["version", "trigger", "weekday", "hour", "condition", "actions"],
  properties: {
    version: { type: "integer", enum: [1] },
    trigger: {
      type: "string",
      enum: [
        "WEEKLY",
        "TASK_COMPLETED",
        "DUE_SOON",
        "OVERDUE",
        "DRAWING_RELEASED",
      ],
    },
    weekday: { type: "integer", minimum: 0, maximum: 6 },
    hour: { type: "integer", minimum: 0, maximum: 23 },
    condition: {
      type: "object",
      additionalProperties: false,
      properties: { label: { type: "string", enum: labels } },
    },
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "title", "dueDays"],
        properties: {
          type: { type: "string", enum: ["CREATE_TASK", "REMIND", "LABEL"] },
          title: { type: "string", minLength: 1, maxLength: 300 },
          dueDays: { type: "integer", minimum: 0, maximum: 90 },
          label: { type: "string", enum: labels },
        },
      },
    },
  },
} as const;
