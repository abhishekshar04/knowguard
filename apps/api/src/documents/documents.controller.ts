import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { DocumentDetails, DocumentListResponse } from '@knowguard/types';
import {
  type CreateDocumentInput,
  createDocumentSchema,
  type ListDocumentsQuery,
  listDocumentsQuerySchema,
  type SetDocumentAclInput,
  setDocumentAclSchema,
  type SetDocumentVisibilityInput,
  setDocumentVisibilitySchema,
  type UpdateDocumentInput,
  updateDocumentSchema,
} from '@knowguard/validation';

import type { AuthContext } from '../auth/auth-context';
import { CurrentAuth } from '../auth/auth.decorators';
import { RequirePermission } from '../authorization/require-permission.decorator';
import { ParseIdPipe } from '../common/parse-id.pipe';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { DocumentsService, type UploadedFileInput } from './documents.service';

const documentId = new ParseIdPipe('document');
const versionId = new ParseIdPipe('document version');

/** RFC 6266/5987 attachment header that survives any filename (quotes, non-ASCII). */
function attachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/**
 * @RequirePermission is the capability gate (e.g. no "document.update" → 403 before any
 * lookup). The service then applies the per-document authorization engine.
 */
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @RequirePermission('document.read')
  list(
    @CurrentAuth() auth: AuthContext,
    @Query(new ZodValidationPipe(listDocumentsQuerySchema)) query: ListDocumentsQuery,
  ): Promise<DocumentListResponse> {
    return this.documents.list(auth, query);
  }

  /** multipart/form-data: file + title, description?, visibility?, audienceIds? */
  @Post()
  @RequirePermission('document.create')
  @UseInterceptors(FileInterceptor('file'))
  create(
    @CurrentAuth() auth: AuthContext,
    @UploadedFile() file: UploadedFileInput | undefined,
    @Body(new ZodValidationPipe(createDocumentSchema)) body: CreateDocumentInput,
  ): Promise<DocumentDetails> {
    return this.documents.create(auth, file, body);
  }

  @Get(':id')
  @RequirePermission('document.read')
  get(@CurrentAuth() auth: AuthContext, @Param('id', documentId) id: string): Promise<DocumentDetails> {
    return this.documents.get(auth, id);
  }

  @Get(':id/download')
  @RequirePermission('document.read')
  async download(
    @CurrentAuth() auth: AuthContext,
    @Param('id', documentId) id: string,
  ): Promise<StreamableFile> {
    const file = await this.documents.download(auth, id);
    return new StreamableFile(file.body, {
      type: file.mimeType,
      length: file.size,
      disposition: attachment(file.filename),
    });
  }

  @Get(':id/versions/:versionId/download')
  @RequirePermission('document.read')
  async downloadVersion(
    @CurrentAuth() auth: AuthContext,
    @Param('id', documentId) id: string,
    @Param('versionId', versionId) version: string,
  ): Promise<StreamableFile> {
    const file = await this.documents.download(auth, id, version);
    return new StreamableFile(file.body, {
      type: file.mimeType,
      length: file.size,
      disposition: attachment(file.filename),
    });
  }

  @Patch(':id')
  @RequirePermission('document.update')
  update(
    @CurrentAuth() auth: AuthContext,
    @Param('id', documentId) id: string,
    @Body(new ZodValidationPipe(updateDocumentSchema)) body: UpdateDocumentInput,
  ): Promise<DocumentDetails> {
    return this.documents.update(auth, id, body);
  }

  @Post(':id/versions')
  @RequirePermission('document.update')
  @UseInterceptors(FileInterceptor('file'))
  addVersion(
    @CurrentAuth() auth: AuthContext,
    @Param('id', documentId) id: string,
    @UploadedFile() file: UploadedFileInput | undefined,
  ): Promise<DocumentDetails> {
    return this.documents.addVersion(auth, id, file);
  }

  @Post(':id/reindex')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermission('document.update')
  reindex(@CurrentAuth() auth: AuthContext, @Param('id', documentId) id: string): Promise<DocumentDetails> {
    return this.documents.reindex(auth, id);
  }

  @Put(':id/visibility')
  @RequirePermission('document.share')
  setVisibility(
    @CurrentAuth() auth: AuthContext,
    @Param('id', documentId) id: string,
    @Body(new ZodValidationPipe(setDocumentVisibilitySchema)) body: SetDocumentVisibilityInput,
  ): Promise<DocumentDetails> {
    return this.documents.setVisibility(auth, id, body);
  }

  @Put(':id/permissions')
  @RequirePermission('document.share')
  setAcl(
    @CurrentAuth() auth: AuthContext,
    @Param('id', documentId) id: string,
    @Body(new ZodValidationPipe(setDocumentAclSchema)) body: SetDocumentAclInput,
  ): Promise<DocumentDetails> {
    return this.documents.setAcl(auth, id, body.entries);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('document.delete')
  async remove(@CurrentAuth() auth: AuthContext, @Param('id', documentId) id: string): Promise<void> {
    await this.documents.remove(auth, id);
  }
}
