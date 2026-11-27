import { NextRequest, NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionPrincipal } from "@/server/auth/session";
import {
  previewLeadImport,
  confirmLeadImportBatch,
  undoLeadImportBatch,
  importAsanaTasksBatch,
} from "@/server/domain/enquiries/import-service";
import { publicError, errorStatus } from "@/server/http/errors";

export async function POST(request: NextRequest) {
  const { env } = await getCloudflareContext({ async: true });
  const auth = await getSessionPrincipal(request, env);
  if (!auth.principal) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await request.json()) as any;
    if (body.action === "preview") {
      const result = await previewLeadImport(auth.principal, env.DB, {
        rows: body.rows || [],
        defaultRequirementNote: body.defaultRequirementNote,
        stageMapping: body.stageMapping,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "confirm") {
      const result = await confirmLeadImportBatch(
        auth.principal,
        env.DB,
        {
          batchId: body.batchId,
          fileName: body.fileName,
          fileSha256: body.fileSha256,
          fileBytes: body.fileBytes,
          mapping: body.mapping || {},
          rows: body.rows || [],
          defaultRequirementNote: body.defaultRequirementNote,
          stageMapping: body.stageMapping,
        },
        env.PROJECT_FILES as any
      );
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "undo") {
      const result = await undoLeadImportBatch(auth.principal, env.DB, body.batchId);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === "asana_import") {
      const result = await importAsanaTasksBatch(auth.principal, env.DB, {
        batchId: body.batchId,
        rows: body.rows || [],
        projectId: body.projectId,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    return NextResponse.json({ error: "Unknown import action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: publicError(err), code: (err as any)?.code || "IMPORT_ERROR" },
      { status: errorStatus(err) }
    );
  }
}
