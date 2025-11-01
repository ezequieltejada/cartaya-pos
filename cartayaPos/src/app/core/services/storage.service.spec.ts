import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage-angular';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;
  let storageMock: jasmine.SpyObj<Storage>;

  beforeEach(() => {
    const storage = jasmine.createSpyObj('Storage', [
      'create',
      'set',
      'getItem',
      'removeItem',
      'clear',
    ]);

    TestBed.configureTestingModule({
      providers: [StorageService, { provide: Storage, useValue: storage }],
    });

    service = TestBed.inject(StorageService);
    storageMock = TestBed.inject(Storage) as jasmine.SpyObj<Storage>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('init', () => {
    it('should call storage.create', async () => {
      storageMock.create.and.returnValue(Promise.resolve());

      await service.init();

      expect(storageMock.create).toHaveBeenCalled();
    });

    it('should not call create twice', async () => {
      storageMock.create.and.returnValue(Promise.resolve());

      await service.init();
      await service.init();

      expect(storageMock.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('set', () => {
    it('should store value as JSON', async () => {
      storageMock.create.and.returnValue(Promise.resolve());
      storageMock.set.and.returnValue(Promise.resolve());

      await service.init();
      await service.set('test-key', { data: 'test-value' });

      expect(storageMock.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify({ data: 'test-value' })
      );
    });

    it('should throw error if not initialized', async () => {
      try {
        await service.set('test-key', { data: 'test' });
        fail('should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('not initialized');
      }
    });
  });

  describe('get', () => {
    it('should return parsed value from storage', async () => {
      const testData = { data: 'test-value' };
      storageMock.create.and.returnValue(Promise.resolve());
      storageMock.getItem.and.returnValue(Promise.resolve(JSON.stringify(testData)));

      await service.init();
      const result = await service.get('test-key');

      expect(result).toEqual(testData);
    });

    it('should return null if key not found', async () => {
      storageMock.create.and.returnValue(Promise.resolve());
      storageMock.getItem.and.returnValue(Promise.resolve(null));

      await service.init();
      const result = await service.get('nonexistent-key');

      expect(result).toBeNull();
    });

    it('should handle malformed JSON gracefully', async () => {
      storageMock.create.and.returnValue(Promise.resolve());
      storageMock.getItem.and.returnValue(Promise.resolve('invalid json'));

      await service.init();
      const result = await service.get('test-key');

      expect(result).toBeNull();
    });

    it('should throw error if not initialized', async () => {
      try {
        await service.get('test-key');
        fail('should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('not initialized');
      }
    });
  });

  describe('remove', () => {
    it('should remove item from storage', async () => {
      storageMock.create.and.returnValue(Promise.resolve());
      storageMock.removeItem.and.returnValue(Promise.resolve());

      await service.init();
      await service.remove('test-key');

      expect(storageMock.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should throw error if not initialized', async () => {
      try {
        await service.remove('test-key');
        fail('should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('not initialized');
      }
    });
  });

  describe('clear', () => {
    it('should clear all storage', async () => {
      storageMock.create.and.returnValue(Promise.resolve());
      storageMock.clear.and.returnValue(Promise.resolve());

      await service.init();
      await service.clear();

      expect(storageMock.clear).toHaveBeenCalled();
    });

    it('should throw error if not initialized', async () => {
      try {
        await service.clear();
        fail('should have thrown');
      } catch (error) {
        expect((error as Error).message).toContain('not initialized');
      }
    });
  });
});
