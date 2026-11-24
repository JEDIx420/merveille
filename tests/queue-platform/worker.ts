/** Isolated platform retry/DLQ probe. No identity fixtures, app bindings or HTTP ingress. */
interface Env { STATE: D1Database }
export default {
  async fetch() { return new Response("Not found", {status:404}); },
  async queue(batch: MessageBatch<{caseId:string}>, env: Env) {
    for (const message of batch.messages) {
      const id=message.body?.caseId;
      if (id !== "retry_then_ack" && id !== "dead_letter") { message.ack(); continue; }
      await env.STATE.prepare("INSERT OR IGNORE INTO attempts(case_id,attempt,created_at) VALUES(?,?,?)")
        .bind(id,message.attempts,Date.now()).run();
      if (id === "dead_letter" || message.attempts < 2) message.retry({delaySeconds:1});
      else message.ack();
    }
  },
} satisfies ExportedHandler<Env>;
