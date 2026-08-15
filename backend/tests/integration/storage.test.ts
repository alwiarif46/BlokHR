import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import type { MockStorageProvider } from '../../src/services/storage';

describe('File Storage Module', () => {
  let app: Express;
  let db: DatabaseEngine;
  let mockStorage: MockStorageProvider;

  const EMAIL = 'alice@shaavir.com';
  // Tiny PNG (1x1 white pixel) in base64
  const TINY_FILE =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    mockStorage = setup.mockStorage;

    await seedMember(db, {
      email: EMAIL,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '09:00',
      groupShiftEnd: '18:00',
    });
  });

  afterEach(async () => {
    mockStorage.reset();
    await db.close();
  });

  // ── Config ──

  describe('Storage config', () => {
    it('returns default config (local)', async () => {
      const res = await request(app).get('/api/storage/config');
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('local');
      expect(res.body.maxFileSizeMb).toBe(25);
    });

    it('updates storage config to azure', async () => {
      const res = await request(app)
        .put('/api/storage/config')
        .send({
          provider: 'azure_blob',
          azureConnectionString: 'DefaultEndpointsProtocol=https;AccountName=test;AccountKey=abc;',
          azureContainer: 'my-container',
        });

      expect(res.status).toBe(200);

      const config = await request(app).get('/api/storage/config');
      expect(config.body.provider).toBe('azure_blob');
      expect(config.body.azureContainer).toBe('my-container');
      expect(config.body.azureConnectionStringSet).toBe(true);
    });

    it('updates storage config to aws s3', async () => {
      await request(app)
        .put('/api/storage/config')
        .send({
          provider: 'aws_s3',
          awsRegion: 'ap-south-1',
          awsBucket: 'my-bucket',
          awsAccessKey: 'AKIA...',
          awsSecretKey: 'secret...',
        });

      const config = await request(app).get('/api/storage/config');
      expect(config.body.provider).toBe('aws_s3');
      expect(config.body.awsRegion).toBe('ap-south-1');
      expect(config.body.awsBucket).toBe('my-bucket');
      expect(config.body.awsAccessKeySet).toBe(true);
      expect(config.body.awsSecretKeySet).toBe(true);
    });

    it('updates to none (disabled)', async () => {
      await request(app)
        .put('/api/storage/config')
        .send({ provider: 'none' });

      const config = await request(app).get('/api/storage/config');
      expect(config.body.provider).toBe('none');
    });

    it('updates max file size', async () => {
      await request(app)
        .put('/api/storage/config')
        .send({ maxFileSizeMb: 50 });

      const config = await request(app).get('/api/storage/config');
      expect(config.body.maxFileSizeMb).toBe(50);
    });

    it('never exposes secrets in config response', async () => {
      await request(app)
        .put('/api/storage/config')
        .send({
          provider: 'azure_blob',
          azureConnectionString: 'SuperSecret123',
        });

      const config = await request(app).get('/api/storage/config');
      expect(config.body.azureConnectionString).toBeUndefined();
      expect(config.body.azureConnectionStringSet).toBe(true);
    });
  });

  // ── Upload ──

  describe('POST /api/storage/upload', () => {
    it('uploads a file successfully', async () => {
      const res = await request(app)
        .post('/api/storage/upload')
        .send({
          email: EMAIL,
          file: TINY_FILE,
          originalName: 'photo.png',
          mimeType: 'image/png',
          contextType: 'profile_photo',
        });

      expect(res.status).toBe(201);
      expect(res.body.original_name).toBe('photo.png');
      expect(res.body.mime_type).toBe('image/png');
      expect(res.body.uploaded_by).toBe(EMAIL);
      expect(res.body.context_type).toBe('profile_photo');
      expect(res.body.size_bytes).toBeGreaterThan(0);
      expect(res.body.id).toBeTruthy();

      // Verify mock storage received the file
      expect(mockStorage.calls).toHaveLength(1);
      expect(mockStorage.calls[0].method).toBe('upload');
    });

    it('handles data URI prefix', async () => {
      const res = await request(app)
        .post('/api/storage/upload')
        .send({
          email: EMAIL,
          file: `data:image/png;base64,${TINY_FILE}`,
          originalName: 'pic.png',
          mimeType: 'image/png',
        });

      expect(res.status).toBe(201);
    });

    it('rejects missing file', async () => {
      const res = await request(app)
        .post('/api/storage/upload')
        .send({ email: EMAIL, originalName: 'test.txt' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('file');
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/storage/upload')
        .send({ file: TINY_FILE, originalName: 'test.txt' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('rejects empty file data', async () => {
      const res = await request(app)
        .post('/api/storage/upload')
        .send({ email: EMAIL, file: '', originalName: 'test.txt' });

      expect(res.status).toBe(400);
    });
  });

  // ── List & Get ──

  describe('File listing and retrieval', () => {
    async function uploadFile(name: string, contextType = ''): Promise<string> {
      const res = await request(app)
        .post('/api/storage/upload')
        .send({
          email: EMAIL, file: TINY_FILE,
          originalName: name, mimeType: 'image/png',
          contextType,
        });
      return res.body.id;
    }

    it('lists uploaded files', async () => {
      await uploadFile('file1.png');
      await uploadFile('file2.png');

      const res = await request(app).get('/api/storage/files');
      expect(res.status).toBe(200);
      expect(res.body.files).toHaveLength(2);
    });

    it('filters by uploader', async () => {
      await uploadFile('mine.png');

      const res = await request(app).get(`/api/storage/files?email=${EMAIL}`);
      expect(res.body.files).toHaveLength(1);
      expect(res.body.files[0].uploaded_by).toBe(EMAIL);
    });

    it('filters by context type', async () => {
      await uploadFile('photo.png', 'profile_photo');
      await uploadFile('doc.png', 'document');

      const res = await request(app).get('/api/storage/files?contextType=profile_photo');
      expect(res.body.files).toHaveLength(1);
    });

    it('gets file metadata by ID', async () => {
      const fileId = await uploadFile('info.png');

      const res = await request(app).get(`/api/storage/files/${fileId}`);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(fileId);
      expect(res.body.original_name).toBe('info.png');
    });

    it('returns 404 for nonexistent file', async () => {
      const res = await request(app).get('/api/storage/files/nonexistent');
      expect(res.status).toBe(404);
    });
  });

  // ── Download ──

  describe('GET /api/storage/files/:id/download', () => {
    it('downloads a file', async () => {
      const upload = await request(app)
        .post('/api/storage/upload')
        .send({
          email: EMAIL, file: TINY_FILE,
          originalName: 'download-me.png', mimeType: 'image/png',
        });

      const res = await request(app).get(`/api/storage/files/${upload.body.id}/download`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['content-disposition']).toContain('download-me.png');
      expect(res.body).toBeTruthy();
    });

    it('returns 404 for nonexistent download', async () => {
      const res = await request(app).get('/api/storage/files/nonexistent/download');
      expect(res.status).toBe(404);
    });
  });

  // ── Delete ──

  describe('DELETE /api/storage/files/:id', () => {
    it('deletes a file', async () => {
      const upload = await request(app)
        .post('/api/storage/upload')
        .send({ email: EMAIL, file: TINY_FILE, originalName: 'delete-me.png', mimeType: 'image/png' });

      const del = await request(app).delete(`/api/storage/files/${upload.body.id}`);
      expect(del.status).toBe(200);

      // Verify gone from listing
      const list = await request(app).get('/api/storage/files');
      expect(list.body.files).toHaveLength(0);

      // Verify gone from mock storage
      const deleteCalls = mockStorage.calls.filter(c => c.method === 'delete');
      expect(deleteCalls).toHaveLength(1);
    });

    it('returns 400 for nonexistent delete', async () => {
      const res = await request(app).delete('/api/storage/files/nonexistent');
      expect(res.status).toBe(400);
    });
  });
});
