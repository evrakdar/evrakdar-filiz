import { Injectable } from "@nestjs/common";
import type { AuditLogInput } from "./audit.types";

/**
 * Activity log hook. The Community edition does not keep an activity log,
 * so this does nothing. The Fidan and Cinar editions store every call here.
 */
@Injectable()
export class AuditService {
  logAsync(_input: AuditLogInput) {
    return undefined;
  }
}
