import { UserPrincipal, hasCapability } from "@/server/auth/principal";
export function taskActions(actor: UserPrincipal, task: any, archived = false) {
  const manager = hasCapability(actor, "MANAGER", task.project_id);
  const active = !archived && !["COMPLETED", "CANCELLED"].includes(task.status);
  const worker = manager || task.assignee_user_id === actor.id;
  return {
    start: active && worker && ["TODO", "BLOCKED"].includes(task.status),
    complete:
      active &&
      worker &&
      ["TODO", "IN_PROGRESS", "BLOCKED"].includes(task.status),
    block: active && worker && ["TODO", "IN_PROGRESS"].includes(task.status),
    reopen: !archived && manager && task.status === "COMPLETED",
    assign: active && manager,
    deadline: active && manager,
    cancel: active && manager,
    edit: !archived && task.status !== "CANCELLED",
  };
}
